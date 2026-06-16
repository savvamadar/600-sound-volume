function _browser() {
    if (typeof browser !== 'undefined') {
        return browser;
    } else {
        return chrome;
    }
}

window.latestVolumes = {};
window.latestTabOrigins = {};

function debugLog() {}

function setBadgeText(soundVolume) {
    if (100 === soundVolume) {
        debugLog("clearing badge", { soundVolume: soundVolume });
        _browser().browserAction.setBadgeText({text: null});
    } else {
        var n = Math.max(0, Math.round(Number(soundVolume) || 0));
        var text = n >= 1000 ? "1k" : n.toString();
        debugLog("setting badge", { soundVolume: soundVolume, badgeText: text });
        _browser().browserAction.setBadgeText({text: text});
    }
}

function normalizeSoundVolume(soundVolume) {
    var n = Number(soundVolume);
    return Number.isFinite(n) && n >= 0 ? n : 100;
}

function getLatestVolumeForTab(tabId) {
    if (tabId === null || tabId === undefined) return 100;
    if (window.latestVolumes[tabId] === undefined) return 100;
    return normalizeSoundVolume(window.latestVolumes[tabId]);
}

function setLatestVolumeForTab(tabId, soundVolume) {
    if (tabId === null || tabId === undefined) return 100;
    var n = normalizeSoundVolume(soundVolume);
    debugLog("storing tab volume", {
        tabId: tabId,
        requestedVolume: soundVolume,
        normalizedVolume: n,
        previousVolume: window.latestVolumes[tabId]
    });
    window.latestVolumes[tabId] = n;
    return n;
}

function getOrigin(url) {
    try {
        var a = document.createElement('a');
        a.href = url;
        return a.origin || (a.protocol + '//' + a.host);
    } catch (e) {
        return '';
    }
}

function updateOriginForTab(tabId) {
    if (tabId === null || tabId === undefined || !_browser().tabs || !_browser().tabs.get) return;
    _browser().tabs.get(tabId, function(tab) {
        if (_browser().runtime.lastError || !tab || !tab.url) return;
        var origin = getOrigin(tab.url);
        if (origin) {
            debugLog("recording tab origin", {
                tabId: tabId,
                origin: origin,
                previousOrigin: window.latestTabOrigins[tabId]
            });
            window.latestTabOrigins[tabId] = origin;
        }
    });
}

function withActiveTabId(cb) {
    _browser().tabs.query({'currentWindow': true, 'active': true}, function(tabs) {
        if (tabs && tabs.length > 0 && tabs[0] && tabs[0].id !== undefined) {
            cb(tabs[0].id);
        } else {
            cb(null);
        }
    });
}

function updateBadgeText() {
    withActiveTabId(function(tabId) {
        setBadgeText(getLatestVolumeForTab(tabId));
    });
}

_browser().runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'getVolumeForTab') {
        var tabId = request.data && request.data.tabId;
        if (tabId == null && sender && sender.tab && sender.tab.id != null) {
            tabId = sender.tab.id;
        }
        debugLog("getVolumeForTab", {
            tabId: tabId,
            soundVolume: getLatestVolumeForTab(tabId),
            origin: window.latestTabOrigins[tabId]
        });
        sendResponse({soundVolume: getLatestVolumeForTab(tabId)});
    } else if (request.action === 'reportPageVolume') {
        var tabId = sender && sender.tab && sender.tab.id;
        var vol = request.data && request.data.soundVolume;
        if (tabId != null && vol !== undefined) {
            debugLog("reportPageVolume", { tabId: tabId, volume: vol });
            setLatestVolumeForTab(tabId, vol);
            updateOriginForTab(tabId);
            withActiveTabId(function(activeId) {
                if (activeId === tabId) setBadgeText(getLatestVolumeForTab(tabId));
            });
        }
        sendResponse({});
    } else if (request.action === 'setVolumeForTab') {
        var tabId = request.data && request.data.tabId;
        var vol = request.data && request.data.soundVolume;
        debugLog("setVolumeForTab", { tabId: tabId, volume: vol });
        setLatestVolumeForTab(tabId, vol);
        updateOriginForTab(tabId);
        withActiveTabId(function(activeId) {
            if (activeId === tabId) setBadgeText(getLatestVolumeForTab(tabId));
        });
        if (tabId != null && _browser().tabs && _browser().tabs.executeScript) {
            var clamped = Math.max(0, Math.min(1000, Number(vol)));
            var code = 'document.dispatchEvent(new CustomEvent("sv-volume-set",{detail:{volume:' + clamped + '}}))';
            debugLog("dispatching sv-volume-set", { tabId: tabId, clampedVolume: clamped });
            _browser().tabs.executeScript(tabId, { code: code, allFrames: true }).catch(function(){});
        }
        sendResponse({});
    }
});

_browser().tabs.onRemoved.addListener(function(tabId) {
    debugLog("tab removed; clearing state", { tabId: tabId });
    delete window.latestVolumes[tabId];
    delete window.latestTabOrigins[tabId];
});

_browser().tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    var url = (changeInfo && changeInfo.url) || (tab && tab.url);
    if (!url) return;
    var origin = getOrigin(url);
    if (!origin) return;
    if (window.latestTabOrigins[tabId] && window.latestTabOrigins[tabId] !== origin) {
        debugLog("tab origin changed; clearing remembered volume", {
            tabId: tabId,
            previousOrigin: window.latestTabOrigins[tabId],
            nextOrigin: origin,
            previousVolume: window.latestVolumes[tabId]
        });
        delete window.latestVolumes[tabId];
        withActiveTabId(function(activeId) {
            if (activeId === tabId) setBadgeText(100);
        });
    }
    if (window.latestTabOrigins[tabId] !== origin) {
        debugLog("tab origin updated", {
            tabId: tabId,
            previousOrigin: window.latestTabOrigins[tabId],
            nextOrigin: origin
        });
    }
    window.latestTabOrigins[tabId] = origin;
});

setInterval(updateBadgeText, 500);
