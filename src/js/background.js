function _browser() {
    if (typeof browser !== 'undefined') {
        return browser;
    } else {
        return chrome;
    }
}

window.latestVolumes = {};
window.latestTabOrigins = {};

var MAX_VOLUME_PERCENT = 1000;

function setBadgeText(soundVolume) {
    if (100 === soundVolume) {
        _browser().browserAction.setBadgeText({text: null});
    } else {
        var n = Math.max(0, Math.round(Number(soundVolume) || 0));
        var text = n >= 1000 ? "1k" : n.toString();
        _browser().browserAction.setBadgeText({text: text});
    }
}

function normalizeSoundVolume(soundVolume) {
    var n = Number(soundVolume);
    return Number.isFinite(n) ? Math.max(0, Math.min(MAX_VOLUME_PERCENT, n)) : 100;
}

function getLatestVolumeForTab(tabId) {
    if (tabId === null || tabId === undefined) return 100;
    if (window.latestVolumes[tabId] === undefined) return 100;
    return normalizeSoundVolume(window.latestVolumes[tabId]);
}

function setLatestVolumeForTab(tabId, soundVolume) {
    if (tabId === null || tabId === undefined) return 100;
    var n = normalizeSoundVolume(soundVolume);
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
        if (origin) window.latestTabOrigins[tabId] = origin;
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

function executeScriptInAllFrames(tabId, code) {
    if (tabId == null || !_browser().tabs || !_browser().tabs.executeScript) return;
    try {
        if (typeof browser !== "undefined") {
            var execution = _browser().tabs.executeScript(tabId, { code: code, allFrames: true });
            if (execution && typeof execution.catch === "function") {
                execution.catch(function() {});
            }
        } else {
            _browser().tabs.executeScript(tabId, { code: code, allFrames: true }, function() {
                void _browser().runtime.lastError;
            });
        }
    } catch (error) {}
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
        sendResponse({soundVolume: getLatestVolumeForTab(tabId)});
    } else if (request.action === 'setVolumeForTab') {
        var tabId = request.data && request.data.tabId;
        var vol = request.data && request.data.soundVolume;
        var appliedVolume = setLatestVolumeForTab(tabId, vol);
        updateOriginForTab(tabId);
        withActiveTabId(function(activeId) {
            if (activeId === tabId) setBadgeText(getLatestVolumeForTab(tabId));
        });
        if (tabId != null && _browser().tabs && _browser().tabs.executeScript) {
            var code = 'document.dispatchEvent(new CustomEvent("sv-volume-set",{detail:{volume:' + appliedVolume + '}}))';
            executeScriptInAllFrames(tabId, code);
        }
        sendResponse({});
    }
});

_browser().tabs.onRemoved.addListener(function(tabId) {
    delete window.latestVolumes[tabId];
    delete window.latestTabOrigins[tabId];
});

_browser().tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    var url = (changeInfo && changeInfo.url) || (tab && tab.url);
    if (!url) return;
    var origin = getOrigin(url);
    if (!origin) return;
    if (window.latestTabOrigins[tabId] && window.latestTabOrigins[tabId] !== origin) {
        delete window.latestVolumes[tabId];
        withActiveTabId(function(activeId) {
            if (activeId === tabId) setBadgeText(100);
        });
    }
    window.latestTabOrigins[tabId] = origin;
});

if (_browser().tabs.onActivated) {
    _browser().tabs.onActivated.addListener(updateBadgeText);
}
if (_browser().windows && _browser().windows.onFocusChanged) {
    _browser().windows.onFocusChanged.addListener(updateBadgeText);
}
updateBadgeText();
