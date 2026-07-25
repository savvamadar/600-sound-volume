(function initializeVolumeBooster() {
if (window.__svContentControllerInstalled) return;
window.__svContentControllerInstalled = true;

window.localSoundVolume = 100;
window.__svObservedMediaElements = window.__svObservedMediaElements || [];

const MAX_VOLUME_PERCENT = 1000;
const HOSTS_TO_IGNORE = [];

function _browser() {
    if (typeof chrome !== "undefined") return chrome;
    return browser;
}

function hostToIgnore(url) {
    if (!url) return false;
    for (let i = 0; i < HOSTS_TO_IGNORE.length; i++) {
        if (url.indexOf(HOSTS_TO_IGNORE[i]) > -1) return true;
    }
    return false;
}

function clampUnit(value) {
    var n = Number(value);
    if (!Number.isFinite(n)) return 1;
    return Math.max(0, Math.min(1, n));
}

function normalizeSoundVolume(value) {
    var n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(MAX_VOLUME_PERCENT, n)) : 100;
}

function getAddonMultiplier() {
    return normalizeSoundVolume(window.localSoundVolume) / 100;
}

function beginInternalMediaUpdate(el) {
    el.__svInternalUpdateCount = (el.__svInternalUpdateCount || 0) + 1;
    el.__svInternalUpdateUntil = Date.now() + 750;
}

function endInternalMediaUpdate(el) {
    setTimeout(function() {
        if (el.__svInternalUpdateCount > 0) el.__svInternalUpdateCount--;
    }, 0);
}

function isInternalMediaUpdate(el) {
    return !!el.__svInternalUpdateCount || Date.now() < (el.__svInternalUpdateUntil || 0);
}

function rememberBaseState(el) {
    if (!el) return;
    if (isInternalMediaUpdate(el)) return;
    el.__svBaseVolume = clampUnit(el.volume);
    el.__svBaseMuted = !!el.muted;
}

function ensureBaseState(el) {
    if (typeof el.__svBaseVolume !== 'number' || !Number.isFinite(el.__svBaseVolume)) {
        el.__svBaseVolume = clampUnit(el.volume);
    }
    if (typeof el.__svBaseMuted !== 'boolean') {
        el.__svBaseMuted = !!el.muted;
    }
}

function applyNativeState(el, volume, muted) {
    var nextVolume = clampUnit(volume);
    var nextMuted = !!muted;
    beginInternalMediaUpdate(el);
    try {
        if (el.volume !== nextVolume) el.volume = nextVolume;
        if (el.muted !== nextMuted) el.muted = nextMuted;
    } catch (e) {}
    endInternalMediaUpdate(el);
}

function restoreBaseState(el) {
    ensureBaseState(el);
    applyNativeState(el, el.__svBaseVolume, el.__svBaseMuted);
}

function getOrigin(url) {
    try {
        var a = document.createElement('a');
        a.href = url;
        return a.origin || (a.protocol + '//' + a.host);
    } catch (e) { return ''; }
}

function isCrossOriginNoCors(el) {
    var src = el.src || el.currentSrc;
    if (!src || src.substring(0, 5) === 'blob:' || src.substring(0, 5) === 'data:') return false;
    var pageOrigin = getOrigin(location.href);
    var mediaOrigin = getOrigin(src);
    return mediaOrigin && mediaOrigin !== pageOrigin && el.crossOrigin !== 'anonymous';
}

function refreshMediaKey(el, src) {
    var key = src || el.currentSrc || el.src || '';
    if (el.__svMediaKey === key) return;
    el.__svMediaKey = key;
    el.__svGraphFailedForKey = null;
}

function applyDirectMultiplier(target) {
    ensureBaseState(target);
    var multiplier = Math.min(1, getAddonMultiplier());
    var volume = Math.min(1, target.__svBaseVolume * multiplier);
    var muted = target.__svBaseMuted || multiplier === 0 || target.__svBaseVolume === 0;
    applyNativeState(target, volume, muted);
    setGraphGain(target, 1);
}

function isActiveMedia(target) {
    return !target.paused && !target.ended && target.readyState > 0;
}

function isMediaAttached(target) {
    if (!target || target.ownerDocument !== document) return false;
    if (typeof target.isConnected === "boolean") return target.isConnected;
    return !!(document.documentElement && document.documentElement.contains(target));
}

function getKnownMediaElements(doc) {
    var known = [];
    var domMedia = doc.querySelectorAll('video, audio');
    for (var i = 0; i < domMedia.length; i++) {
        if (known.indexOf(domMedia[i]) === -1) known.push(domMedia[i]);
    }
    for (var j = 0; j < window.__svObservedMediaElements.length; j++) {
        var el = window.__svObservedMediaElements[j];
        if (el && known.indexOf(el) === -1) known.push(el);
    }
    return known;
}

function pruneObservedMediaElements() {
    window.__svObservedMediaElements = window.__svObservedMediaElements.filter(function(el) {
        return isMediaAttached(el);
    });
}

function setGraphGain(target, value) {
    if (!target || !target.creategain || !target.creategain.gain) return;
    var gain = Number(value);
    if (!Number.isFinite(gain)) gain = 1;
    target.creategain.gain.value = Math.max(0, Math.min(MAX_VOLUME_PERCENT / 100, gain));
}

function adoptLegacyFallbackGraph(target) {
    if (target.audiocontext && target.creategain && target.source) return;
    if (!target.__svCtx || !target.__svGain || !target.__svSource) return;
    target.audiocontext = target.__svCtx;
    target.creategain = target.__svGain;
    target.source = target.__svSource;
    target.__svGraphConnected = true;
}

function reconnectMediaGraph(target) {
    if (!target.creategain || !target.audiocontext) return false;
    if (target.__svGraphConnected === false) {
        try {
            target.creategain.connect(target.audiocontext.destination);
            target.__svGraphConnected = true;
        } catch (e) {
            return false;
        }
    } else if (target.__svGraphConnected === undefined) {
        // Graphs made by an earlier version were connected when they were created.
        target.__svGraphConnected = true;
    }
    target.__svDetached = false;
    return true;
}

function disconnectMediaGraph(target) {
    if (!target) return;
    adoptLegacyFallbackGraph(target);
    target.__svDetached = true;
    if (!target.creategain) return;
    setGraphGain(target, 0);
    if (target.__svGraphConnected !== false) {
        try {
            target.creategain.disconnect();
        } catch (e) {}
    }
    target.__svGraphConnected = false;
}

function resumeAudioContext(target) {
    if (!target.audiocontext || target.audiocontext.state !== "suspended") return;
    try {
        var resumeResult = target.audiocontext.resume();
        if (resumeResult && typeof resumeResult.catch === "function") {
            resumeResult.catch(function() {});
        }
    } catch (e) {}
}

function ensureAudioContext(target, src) {
    adoptLegacyFallbackGraph(target);
    if (target.audiocontext && target.creategain && target.source) {
        if (target.audiocontext.state === 'closed') {
            target.audiocontext = null;
            target.creategain = null;
            target.source = null;
            target.__svGraphConnected = false;
        } else {
            if (!reconnectMediaGraph(target)) return false;
            resumeAudioContext(target);
            return true;
        }
    }

    var mediaKey = src || target.currentSrc || target.src || "";
    if (target.__svGraphFailedForKey === mediaKey) return false;

    // Never leave a half-created graph published on the media element.
    if (target.audiocontext || target.creategain || target.source) {
        try {
            if (target.creategain) target.creategain.disconnect();
        } catch (e) {}
        try {
            if (target.audiocontext && target.audiocontext.state !== "closed") {
                var closeResult = target.audiocontext.close();
                if (closeResult && typeof closeResult.catch === "function") {
                    closeResult.catch(function() {});
                }
            }
        } catch (e) {}
        target.audiocontext = null;
        target.creategain = null;
        target.source = null;
        target.__svGraphConnected = false;
    }

    ensureBaseState(target);
    if (target.crossOrigin !== 'anonymous') {
        restoreBaseState(target);
        target.setAttribute('crossorigin', 'anonymous');
        target.crossOrigin = 'anonymous';
        if (src && src.indexOf('https://') === -1 && location.href && location.href.indexOf('https://') === 0) {
            src = src.replace('http://', 'https://');
        }
        if (src.substring(0, 5) !== "blob:") {
            var wasPlaying = !target.paused;
            target.src = src + '';
            if (wasPlaying) target.play();
        }
    }

    var audioContext = null;
    var gainNode = null;
    var sourceNode = null;
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        gainNode = audioContext.createGain();
        sourceNode = audioContext.createMediaElementSource(target);
        sourceNode.connect(gainNode);
        gainNode.connect(audioContext.destination);
        target.audiocontext = audioContext;
        target.creategain = gainNode;
        target.source = sourceNode;
        target.__svGraphConnected = true;
        target.__svDetached = false;
        target.__svGraphFailedForKey = null;
        resumeAudioContext(target);
        return true;
    } catch (e) {
        try {
            if (gainNode) gainNode.disconnect();
        } catch (disconnectError) {}
        try {
            if (audioContext && audioContext.state !== "closed") {
                var failedCloseResult = audioContext.close();
                if (failedCloseResult && typeof failedCloseResult.catch === "function") {
                    failedCloseResult.catch(function() {});
                }
            }
        } catch (closeError) {}
        target.__svGraphFailedForKey = mediaKey;
        return false;
    }
}

function changeSoundVolume(doc) {
    var media = getKnownMediaElements(doc);
    var multiplier = getAddonMultiplier();
    for (var i = 0; i < media.length; i++) {
        var target = media[i];

        if (!isMediaAttached(target)) {
            disconnectMediaGraph(target);
            continue;
        }

        var src = target.src || target.currentSrc;
        if (!src || hostToIgnore(src)) continue;
        refreshMediaKey(target, src);
        ensureBaseState(target);

        if (!isActiveMedia(target)) {
            setGraphGain(target, 0);
            continue;
        }

        if (isCrossOriginNoCors(target)) {
            applyDirectMultiplier(target);
            continue;
        }

        if (multiplier <= 1 && !target.audiocontext) {
            applyDirectMultiplier(target);
            continue;
        }

        if (!ensureAudioContext(target, src)) {
            if (multiplier <= 1) {
                applyDirectMultiplier(target);
            } else {
                restoreBaseState(target);
                setGraphGain(target, 1);
            }
            continue;
        }

        setGraphGain(target, multiplier);
    }
    pruneObservedMediaElements();
}

function getGraphGain(el) {
    try {
        return el.creategain && el.creategain.gain ? el.creategain.gain.value : null;
    } catch (e) {
        return null;
    }
}

function reconcileMediaState() {
    var media = getKnownMediaElements(document);
    var multiplier = getAddonMultiplier();
    var needsApply = false;

    for (var i = 0; i < media.length; i++) {
        var el = media[i];
        adoptLegacyFallbackGraph(el);
        var hasGraph = !!(el.audiocontext && el.creategain && el.source);

        if (!isMediaAttached(el)) {
            if (hasGraph) disconnectMediaGraph(el);
            continue;
        }

        var src = el.currentSrc || el.src;
        if (!src || hostToIgnore(src)) {
            if (hasGraph) setGraphGain(el, 0);
            continue;
        }

        if (!isActiveMedia(el)) {
            setGraphGain(el, 0);
            continue;
        }

        if (hasGraph && el.__svGraphConnected === false) {
            needsApply = true;
            continue;
        }

        if (hasGraph) {
            if (Math.abs((getGraphGain(el) || 0) - multiplier) > 0.001) {
                setGraphGain(el, multiplier);
            }
            if (el.audiocontext.state === "suspended") resumeAudioContext(el);
            continue;
        }

        if (
            multiplier > 1 &&
            !isCrossOriginNoCors(el) &&
            el.__svGraphFailedForKey !== src
        ) {
            needsApply = true;
        }
    }

    if (needsApply) scheduleApply();
    pruneObservedMediaElements();
}

var scheduleApplyTimer = null;

function scheduleApply() {
    if (scheduleApplyTimer) clearTimeout(scheduleApplyTimer);
    scheduleApplyTimer = setTimeout(function() {
        scheduleApplyTimer = null;
        changeSoundVolume(window.document);
    }, 150);
}

function applyVolume(vol) {
    window.localSoundVolume = normalizeSoundVolume(vol);
    if (scheduleApplyTimer) clearTimeout(scheduleApplyTimer);
    scheduleApplyTimer = null;
    changeSoundVolume(window.document);
}

function checkBoostAvailability() {
    try {
        var media = document.querySelectorAll('video, audio');
        for (var i = 0; i < media.length; i++) {
            if (isCrossOriginNoCors(media[i])) return { blocked: true };
        }
        return { blocked: false };
    } catch (e) {
        return { blocked: false };
    }
}

_browser().runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'changeSoundVolume') {
        if (request.data && request.data.soundVolume !== undefined) {
            applyVolume(request.data.soundVolume);
        }
        sendResponse({soundVolume: window.localSoundVolume});
    } else if (request.action === 'getSoundVolume') {
        sendResponse({soundVolume: window.localSoundVolume});
    } else if (request.action === 'checkBoostAvailability') {
        sendResponse(checkBoostAvailability());
    }
});

document.addEventListener('sv-volume-set', function(e) {
    if (e.detail && e.detail.volume !== undefined) {
        applyVolume(e.detail.volume);
    }
});

function onPageVolumeChange(el) {
    var src = el.src || el.currentSrc;
    if (!src || hostToIgnore(src)) return;
    if (isInternalMediaUpdate(el)) return;
    rememberBaseState(el);
    scheduleApply();
}

function silenceInactiveMedia() {
    if (!isActiveMedia(this)) setGraphGain(this, 0);
}

function observeMediaElement(el) {
    if (window.__svObservedMediaElements.indexOf(el) === -1) {
        window.__svObservedMediaElements.push(el);
    }
    if (el.__svObserved) {
        if (!el.__svDetached) return false;
        el.__svDetached = false;
        return true;
    }
    el.__svObserved = true;
    el.__svDetached = false;
    rememberBaseState(el);
    el.addEventListener('play', scheduleApply);
    el.addEventListener('pause', silenceInactiveMedia);
    el.addEventListener('ended', silenceInactiveMedia);
    el.addEventListener('emptied', silenceInactiveMedia);
    el.addEventListener('volumechange', function() { onPageVolumeChange(this); });
    return true;
}

function observeMedia(doc) {
    var media = doc.querySelectorAll('video, audio');
    var changed = false;
    for (var i = 0; i < media.length; i++) {
        if (observeMediaElement(media[i])) changed = true;
    }
    return changed;
}

function resumeBoostFromUserGesture() {
    var media = getKnownMediaElements(document);
    var needsGraph = false;
    var multiplier = getAddonMultiplier();

    for (var i = 0; i < media.length; i++) {
        var el = media[i];
        if (!isMediaAttached(el) || !isActiveMedia(el)) continue;
        if (el.audiocontext && el.audiocontext.state === "suspended") {
            resumeAudioContext(el);
        } else if (
            multiplier > 1 &&
            !el.audiocontext &&
            !isCrossOriginNoCors(el)
        ) {
            needsGraph = true;
        }
    }

    if (needsGraph) changeSoundVolume(document);
}

function forEachMediaInNode(node, callback) {
    if (!node || node.nodeType !== 1) return;
    if (node.matches && node.matches("video, audio")) callback(node);
    if (!node.querySelectorAll) return;
    var descendants = node.querySelectorAll("video, audio");
    for (var i = 0; i < descendants.length; i++) callback(descendants[i]);
}

function disconnectRemovedMedia(records) {
    for (var i = 0; i < records.length; i++) {
        var removedNodes = records[i].removedNodes || [];
        for (var j = 0; j < removedNodes.length; j++) {
            forEachMediaInNode(removedNodes[j], function(el) {
                // A node moved elsewhere in the same document is still safe to use.
                if (!isMediaAttached(el)) disconnectMediaGraph(el);
            });
        }
    }
}

function observeAddedMedia(records) {
    var changed = false;
    for (var i = 0; i < records.length; i++) {
        var addedNodes = records[i].addedNodes || [];
        for (var j = 0; j < addedNodes.length; j++) {
            forEachMediaInNode(addedNodes[j], function(el) {
                if (observeMediaElement(el)) changed = true;
            });
        }
    }
    return changed;
}

function loadSavedVolumeAndApply() {
    try {
        _browser().runtime.sendMessage({ action: "getVolumeForTab" }, function(resp) {
            if (_browser().runtime.lastError) {
                scheduleApply();
                return;
            }
            if (resp && resp.soundVolume !== undefined) {
                window.localSoundVolume = normalizeSoundVolume(resp.soundVolume);
            }
            scheduleApply();
        });
    } catch (e) {
        scheduleApply();
    }
}

function startMediaSafetyMonitor() {
    if (window.__svMediaSafetyTimer) return;
    window.__svMediaSafetyTimer = setInterval(reconcileMediaState, 1000);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        observeMedia(document);
        loadSavedVolumeAndApply();
        startMediaSafetyMonitor();
    });
} else {
    observeMedia(document);
    loadSavedVolumeAndApply();
    startMediaSafetyMonitor();
}

document.addEventListener("pointerdown", resumeBoostFromUserGesture, true);
document.addEventListener("touchstart", resumeBoostFromUserGesture, {
    capture: true,
    passive: true
});

var observer = new MutationObserver(function(records) {
    disconnectRemovedMedia(records || []);
    if (observeAddedMedia(records || [])) scheduleApply();
    pruneObservedMediaElements();
});
observer.observe(document.documentElement, {childList: true, subtree: true});
})();
