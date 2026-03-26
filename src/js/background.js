function _browser() {
    if (typeof browser !== 'undefined') {
        return browser;
    } else {
        return chrome;
    }
}

window.latestVolumes = {};

function setBadgeText(soundVolume) {
    if (100 === soundVolume) {
        _browser().browserAction.setBadgeText({text: null});
    } else {
        _browser().browserAction.setBadgeText({text: soundVolume.toString()});
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
    window.latestVolumes[tabId] = n;
    return n;
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
        sendResponse({soundVolume: getLatestVolumeForTab(tabId)});
    } else if (request.action === 'reportPageVolume') {
        var tabId = sender && sender.tab && sender.tab.id;
        var vol = request.data && request.data.soundVolume;
        if (tabId != null && vol !== undefined) {
            setLatestVolumeForTab(tabId, vol);
            withActiveTabId(function(activeId) {
                if (activeId === tabId) setBadgeText(getLatestVolumeForTab(tabId));
            });
        }
        sendResponse({});
    } else if (request.action === 'setVolumeForTab') {
        var tabId = request.data && request.data.tabId;
        var vol = request.data && request.data.soundVolume;
        setLatestVolumeForTab(tabId, vol);
        withActiveTabId(function(activeId) {
            if (activeId === tabId) setBadgeText(getLatestVolumeForTab(tabId));
        });
        if (tabId != null && _browser().tabs && _browser().tabs.executeScript) {
            var clamped = Math.max(0, Math.min(1000, Number(vol)));
            var code = 'document.dispatchEvent(new CustomEvent("sv-volume-set",{detail:{volume:' + clamped + '}}))';
            _browser().tabs.executeScript(tabId, { code: code, allFrames: true }).catch(function(){});
        }
        sendResponse({});
    }
});

_browser().tabs.onRemoved.addListener(function(tabId) {
    delete window.latestVolumes[tabId];
});

setInterval(updateBadgeText, 500);
