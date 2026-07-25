// Firefox exposes the Chrome-compatible callback API namespace, which keeps
// this Manifest V2 event page compatible with both browsers.
var api = typeof chrome !== "undefined" ? chrome : browser;
var MAX_VOLUME_PERCENT = 1000;
var TAB_STATE_STORAGE_KEY = "svTabStateV1";

window.latestVolumes = {};
window.latestTabOrigins = {};

var tabState = {};
var stateLoaded = false;
var stateWaiters = [];
var persistInFlight = false;
var persistDirty = false;
var persistCallbacks = [];

function normalizeSoundVolume(soundVolume) {
    var n = Number(soundVolume);
    return Number.isFinite(n) ? Math.max(0, Math.min(MAX_VOLUME_PERCENT, n)) : 100;
}

function getStorageArea() {
    if (!api.storage) return null;
    return api.storage.session || api.storage.local || null;
}

function storageGet(callback) {
    var area = getStorageArea();
    if (!area || !area.get) {
        callback({});
        return;
    }

    try {
        area.get(TAB_STATE_STORAGE_KEY, function(items) {
            void api.runtime.lastError;
            callback(items || {});
        });
    } catch (error) {
        callback({});
    }
}

function storageSet(values, callback) {
    var area = getStorageArea();
    if (!area || !area.set) {
        callback();
        return;
    }

    try {
        area.set(values, function() {
            void api.runtime.lastError;
            callback();
        });
    } catch (error) {
        callback();
    }
}

function copyTabState() {
    var copy = {};
    Object.keys(tabState).forEach(function(key) {
        var record = tabState[key];
        copy[key] = {
            volume: normalizeSoundVolume(record.volume),
            origin: typeof record.origin === "string" ? record.origin : ""
        };
    });
    return copy;
}

function flushPersistedState() {
    if (!stateLoaded || persistInFlight || !persistDirty) return;

    persistDirty = false;
    persistInFlight = true;
    var callbacksForWrite = persistCallbacks.splice(0);
    var values = {};
    values[TAB_STATE_STORAGE_KEY] = copyTabState();

    storageSet(values, function() {
        persistInFlight = false;
        callbacksForWrite.forEach(function(callback) {
            try {
                callback();
            } catch (error) {}
        });
        flushPersistedState();
    });
}

function persistState(callback) {
    if (typeof callback === "function") persistCallbacks.push(callback);
    persistDirty = true;
    flushPersistedState();
}

function finishStateLoad(items) {
    var saved = items && items[TAB_STATE_STORAGE_KEY];
    if (saved && typeof saved === "object") {
        Object.keys(saved).forEach(function(key) {
            var record = saved[key];
            if (!record || typeof record !== "object") return;
            var volume = Number(record.volume);
            if (!Number.isFinite(volume)) return;
            var origin = typeof record.origin === "string" ? record.origin : "";
            tabState[key] = {
                volume: normalizeSoundVolume(volume),
                origin: origin
            };
            window.latestVolumes[key] = tabState[key].volume;
            window.latestTabOrigins[key] = origin;
        });
    }

    stateLoaded = true;
    var waiters = stateWaiters.splice(0);
    waiters.forEach(function(callback) {
        try {
            callback();
        } catch (error) {}
    });
    flushPersistedState();
}

function withStateReady(callback) {
    if (stateLoaded) {
        callback();
        return;
    }
    stateWaiters.push(callback);
}

function getOrigin(url) {
    try {
        var a = document.createElement("a");
        a.href = url;
        return a.origin || (a.protocol + "//" + a.host);
    } catch (error) {
        return "";
    }
}

function getLatestVolumeForTab(tabId) {
    if (tabId === null || tabId === undefined) return 100;
    var record = tabState[String(tabId)];
    return record ? normalizeSoundVolume(record.volume) : 100;
}

function setLatestVolumeForTab(tabId, soundVolume, origin) {
    if (tabId === null || tabId === undefined) return 100;
    var key = String(tabId);
    var volume = normalizeSoundVolume(soundVolume);
    var previousOrigin = tabState[key] && tabState[key].origin;
    tabState[key] = {
        volume: volume,
        origin: origin || previousOrigin || ""
    };
    window.latestVolumes[key] = volume;
    window.latestTabOrigins[key] = tabState[key].origin;
    return volume;
}

function clearLatestVolumeForTab(tabId) {
    if (tabId === null || tabId === undefined) return;
    var key = String(tabId);
    delete tabState[key];
    delete window.latestVolumes[key];
    delete window.latestTabOrigins[key];
}

function tabsGet(tabId, callback) {
    if (tabId === null || tabId === undefined || !api.tabs || !api.tabs.get) {
        callback(null);
        return;
    }

    try {
        api.tabs.get(tabId, function(tab) {
            if (api.runtime.lastError) {
                callback(null);
                return;
            }
            callback(tab || null);
        });
    } catch (error) {
        callback(null);
    }
}

function tabsQuery(query, callback) {
    if (!api.tabs || !api.tabs.query) {
        callback([]);
        return;
    }

    try {
        api.tabs.query(query, function(tabs) {
            if (api.runtime.lastError) {
                callback([]);
                return;
            }
            callback(tabs || []);
        });
    } catch (error) {
        callback([]);
    }
}

function resolveTabDetails(request, sender, callback) {
    var data = request.data || {};
    var senderTab = sender && sender.tab;
    var tabId = data.tabId;
    if (tabId === null || tabId === undefined) {
        tabId = senderTab && senderTab.id;
    }

    var url = data.url;
    if (!url && senderTab && senderTab.id === tabId) {
        url = senderTab.url;
    }
    if (url) {
        callback(tabId, getOrigin(url));
        return;
    }

    tabsGet(tabId, function(tab) {
        callback(tabId, getOrigin(tab && tab.url));
    });
}

function readVolumeForOrigin(tabId, origin, callback) {
    if (tabId === null || tabId === undefined) {
        callback(100);
        return;
    }

    var key = String(tabId);
    var record = tabState[key];
    if (!record) {
        callback(100);
        return;
    }

    if (record.origin && origin && record.origin !== origin) {
        clearLatestVolumeForTab(tabId);
        persistState(function() { callback(100); });
        return;
    }

    if (!record.origin && origin) {
        record.origin = origin;
        window.latestTabOrigins[key] = origin;
        persistState(function() { callback(getLatestVolumeForTab(tabId)); });
        return;
    }

    callback(getLatestVolumeForTab(tabId));
}

function setBadgeText(soundVolume) {
    if (!api.browserAction || !api.browserAction.setBadgeText) return;

    var text = "";
    if (soundVolume !== 100) {
        var n = Math.max(0, Math.round(Number(soundVolume) || 0));
        text = n >= 1000 ? "1k" : n.toString();
    }

    try {
        api.browserAction.setBadgeText({ text: text }, function() {
            void api.runtime.lastError;
        });
    } catch (error) {}
}

function withActiveTabId(callback) {
    tabsQuery({ currentWindow: true, active: true }, function(tabs) {
        if (tabs && tabs.length > 0 && tabs[0] && tabs[0].id !== undefined) {
            callback(tabs[0].id);
        } else {
            callback(null);
        }
    });
}

function executeScriptInAllFrames(tabId, code) {
    if (tabId === null || tabId === undefined || !api.tabs || !api.tabs.executeScript) return;

    try {
        api.tabs.executeScript(tabId, { code: code, allFrames: true }, function() {
            void api.runtime.lastError;
        });
    } catch (error) {}
}

function updateBadgeText() {
    withStateReady(function() {
        withActiveTabId(function(tabId) {
            setBadgeText(getLatestVolumeForTab(tabId));
        });
    });
}

function handleRuntimeMessage(request, sender, respond) {
    withStateReady(function() {
        resolveTabDetails(request, sender, function(tabId, origin) {
            if (request.action === "getVolumeForTab") {
                readVolumeForOrigin(tabId, origin, function(volume) {
                    respond({ soundVolume: volume });
                });
                return;
            }

            var volume = request.data && request.data.soundVolume;
            var appliedVolume = setLatestVolumeForTab(tabId, volume, origin);

            withActiveTabId(function(activeId) {
                if (activeId === tabId) setBadgeText(appliedVolume);
            });

            if (tabId !== null && tabId !== undefined) {
                var code = "document.dispatchEvent(new CustomEvent(\"sv-volume-set\",{detail:{volume:" +
                    appliedVolume + "}}))";
                executeScriptInAllFrames(tabId, code);
            }

            persistState(function() {
                respond({ soundVolume: appliedVolume });
            });
        });
    });
}

api.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (!request || (
        request.action !== "getVolumeForTab" &&
        request.action !== "setVolumeForTab"
    )) {
        return undefined;
    }

    handleRuntimeMessage(request, sender, sendResponse);
    return true;
});

if (api.tabs && api.tabs.onRemoved) {
    api.tabs.onRemoved.addListener(function(tabId) {
        withStateReady(function() {
            clearLatestVolumeForTab(tabId);
            persistState();
        });
    });
}

if (api.tabs && api.tabs.onUpdated) {
    api.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
        var url = changeInfo && changeInfo.url;
        if (!url && tab && tab.url) url = tab.url;
        if (!url) return;

        var origin = getOrigin(url);
        if (!origin) return;

        withStateReady(function() {
            var key = String(tabId);
            var record = tabState[key];
            if (!record) return;

            if (record.origin && record.origin !== origin) {
                clearLatestVolumeForTab(tabId);
                persistState();
                withActiveTabId(function(activeId) {
                    if (activeId === tabId) setBadgeText(100);
                });
                return;
            }

            if (!record.origin) {
                record.origin = origin;
                window.latestTabOrigins[key] = origin;
                persistState();
            }
        });
    });
}

if (api.tabs && api.tabs.onActivated) {
    api.tabs.onActivated.addListener(updateBadgeText);
}
if (api.windows && api.windows.onFocusChanged) {
    api.windows.onFocusChanged.addListener(updateBadgeText);
}

storageGet(finishStateLoad);
updateBadgeText();
