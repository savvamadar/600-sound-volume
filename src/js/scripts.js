window.prevSoundVolume = null;
window.localSoundVolume = 100;
window._svUserHasSetVolume = false;

const HOSTS_TO_IGNORE = [];

function debugLog() {}

function _browser() {
    if (typeof browser !== 'undefined') {
        return browser;
    } else {
        return chrome;
    }
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
    return Number.isFinite(n) && n >= 0 ? n : 100;
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
    if (isInternalMediaUpdate(el)) {
        debugLog("ignored internal volumechange", {
            volume: el.volume,
            muted: el.muted,
            internalCount: el.__svInternalUpdateCount || 0,
            internalUntil: el.__svInternalUpdateUntil || 0
        });
        return;
    }
    el.__svBaseVolume = clampUnit(el.volume);
    el.__svBaseMuted = !!el.muted;
    debugLog("remembered base state", {
        baseVolume: el.__svBaseVolume,
        baseMuted: el.__svBaseMuted,
        src: el.currentSrc || el.src || ""
    });
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

function readYouTubePlayerVolume() {
    try {
        document.documentElement.removeAttribute('data-sv-yt-vol-debug');
        var script = document.createElement('script');
        script.textContent = '(function(){try{var p=document.getElementById("movie_player");if(p&&typeof p.getVolume==="function"){document.documentElement.setAttribute("data-sv-yt-vol-debug",String(p.getVolume()));}}catch(e){}})();';
        (document.head || document.documentElement).appendChild(script);
        script.remove();
        var value = document.documentElement.getAttribute('data-sv-yt-vol-debug');
        return value === null ? null : Number(value);
    } catch (e) {
        return null;
    }
}

function getPageVolumeForGain(el) {
    return getPageVolumeInfo(el).volume;
}

function getPageVolumeInfo(el) {
    var ytVolume = readYouTubePlayerVolume();
    if (Number.isFinite(ytVolume)) {
        return {
            source: "youtubePlayer",
            volume: Math.max(0, Math.min(1, ytVolume / 100)),
            rawValue: ytVolume
        };
    }
    return {
        source: el.muted ? "mediaElementMuted" : "mediaElementVolume",
        volume: el.muted ? 0 : clampUnit(el.volume),
        rawValue: el.muted ? 0 : el.volume
    };
}

function refreshMediaKey(el, src) {
    var key = src || el.currentSrc || el.src || '';
    if (el.__svMediaKey === key) return;
    debugLog("media source changed; resetting base state", {
        previousKey: el.__svMediaKey || "",
        nextKey: key
    });
    el.__svMediaKey = key;
    delete el.__svBaseVolume;
    delete el.__svBaseMuted;
}

function applyDirectMultiplier(target) {
    ensureBaseState(target);
    var multiplier = Math.min(1, getAddonMultiplier());
    var volume = Math.min(1, target.__svBaseVolume * multiplier);
    var muted = target.__svBaseMuted || multiplier === 0 || target.__svBaseVolume === 0;
    debugLog("applying direct multiplier", {
        requestedMultiplier: getAddonMultiplier(),
        appliedMultiplier: multiplier,
        baseVolume: target.__svBaseVolume,
        baseMuted: target.__svBaseMuted,
        nextVolume: volume,
        nextMuted: muted,
        src: target.currentSrc || target.src || ""
    });
    applyNativeState(target, volume, muted);
    if (target.creategain) target.creategain.gain.value = 1;
}

function isActiveMedia(target) {
    return !target.paused && !target.ended && target.readyState > 0;
}

function ensureAudioContext(target, src) {
    if (target.audiocontext && target.creategain && target.source) {
        if (target.audiocontext.state === 'closed') {
            debugLog("audio context closed; clearing graph refs", {
                src: target.currentSrc || target.src || ""
            });
            target.audiocontext = null;
            target.creategain = null;
            target.source = null;
        } else {
            if (target.audiocontext.state === 'suspended') {
                debugLog("resuming suspended audio context", {
                    src: target.currentSrc || target.src || ""
                });
                try { target.audiocontext.resume(); } catch (e) {
                    debugLog("audio context resume failed", { error: String(e) });
                }
            }
            return true;
        }
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

    try {
        debugLog("creating audio context graph", {
            src: src || target.currentSrc || target.src || "",
            baseVolume: target.__svBaseVolume,
            baseMuted: target.__svBaseMuted
        });
        target.audiocontext = new (window.AudioContext || window.webkitAudioContext)();
        target.creategain = target.audiocontext.createGain();
        target.source = target.audiocontext.createMediaElementSource(target);
        target.source.connect(target.creategain);
        target.creategain.connect(target.audiocontext.destination);
        if (target.audiocontext.state === 'suspended') {
            target.audiocontext.resume();
        }
        return true;
    } catch (e) {
        debugLog("audio context graph failed", {
            error: String(e),
            src: src || target.currentSrc || target.src || ""
        });
        return false;
    }
}

function changeSoundVolume(doc) {
    var media = doc.querySelectorAll('video, audio');
    var multiplier = getAddonMultiplier();
    debugLog("changeSoundVolume scan", {
        multiplier: multiplier,
        mediaCount: media.length,
        activeCount: Array.prototype.filter.call(media, function (el) {
            return isActiveMedia(el);
        }).length
    });
    for (var i = 0; i < media.length; i++) {
        var target = media[i];
        var src = target.src || target.currentSrc;
        if (!src || hostToIgnore(src)) continue;
        refreshMediaKey(target, src);
        ensureBaseState(target);

        if (!isActiveMedia(target)) {
            if (target.creategain) {
                debugLog("silencing inactive media graph", {
                    multiplier: multiplier,
                    paused: target.paused,
                    ended: target.ended,
                    readyState: target.readyState,
                    src: target.currentSrc || target.src || ""
                });
                target.creategain.gain.value = 0;
            }
            continue;
        }

        if (isCrossOriginNoCors(target)) {
            applyDirectMultiplier(target);
            continue;
        }

        if (multiplier <= 1 && !target.audiocontext) {
            debugLog("using direct path without creating audio graph", {
                multiplier: multiplier,
                baseVolume: target.__svBaseVolume,
                baseMuted: target.__svBaseMuted,
                currentVolume: target.volume,
                currentMuted: target.muted,
                src: target.currentSrc || target.src || ""
            });
            applyDirectMultiplier(target);
            continue;
        }

        if (!ensureAudioContext(target, src)) {
            if (multiplier <= 1) {
                applyDirectMultiplier(target);
            } else {
                debugLog("boost graph unavailable; restoring base instead of direct boost", {
                    multiplier: multiplier,
                    src: target.currentSrc || target.src || ""
                });
                restoreBaseState(target);
                if (target.creategain) target.creategain.gain.value = 1;
            }
            continue;
        }

        var pageVolumeInfo = getPageVolumeInfo(target);
        var desiredGain = getAddonMultiplier() * pageVolumeInfo.volume;
        debugLog("applying gain graph multiplier", {
            multiplier: multiplier,
            previousGain: target.creategain && target.creategain.gain ? target.creategain.gain.value : null,
            desiredGain: desiredGain,
            pageVolumeForGain: pageVolumeInfo.volume,
            pageVolumeSource: pageVolumeInfo.source,
            pageVolumeRawValue: pageVolumeInfo.rawValue,
            baseVolume: target.__svBaseVolume,
            baseMuted: target.__svBaseMuted,
            currentVolume: target.volume,
            currentMuted: target.muted,
            youtubePlayerVolume: readYouTubePlayerVolume(),
            paused: target.paused,
            ended: target.ended,
            readyState: target.readyState,
            src: target.currentSrc || target.src || ""
        });
        target.creategain.gain.value = desiredGain;
    }
}

function getGraphGain(el) {
    try {
        return el.creategain && el.creategain.gain ? el.creategain.gain.value : null;
    } catch (e) {
        return null;
    }
}

function getAudioContextState(el) {
    try {
        return el.audiocontext ? el.audiocontext.state : null;
    } catch (e) {
        return null;
    }
}

function getDesiredGraphGain(el) {
    return getAddonMultiplier() * getPageVolumeForGain(el);
}

function getMediaDebugState(el, index) {
    var src = el.currentSrc || el.src || "";
    var pageVolumeInfo = getPageVolumeInfo(el);
    return {
        index: index,
        active: isActiveMedia(el),
        hasGraph: !!(el.audiocontext && el.creategain && el.source),
        gain: getGraphGain(el),
        desiredGain: getAddonMultiplier() * pageVolumeInfo.volume,
        pageVolumeForGain: pageVolumeInfo.volume,
        pageVolumeSource: pageVolumeInfo.source,
        pageVolumeRawValue: pageVolumeInfo.rawValue,
        youtubePlayerVolume: readYouTubePlayerVolume(),
        audioContextState: getAudioContextState(el),
        volume: el.volume,
        muted: el.muted,
        baseVolume: el.__svBaseVolume,
        baseMuted: el.__svBaseMuted,
        paused: el.paused,
        ended: el.ended,
        readyState: el.readyState,
        currentTime: el.currentTime,
        duration: el.duration,
        src: src.length > 160 ? src.substring(0, 160) + "…" : src
    };
}

function monitorMediaState() {
    var media = document.querySelectorAll('video, audio');
    var multiplier = getAddonMultiplier();
    var states = [];
    var activeCount = 0;
    var graphCount = 0;
    var activeGraphCount = 0;
    var anomalies = [];

    for (var i = 0; i < media.length; i++) {
        var el = media[i];
        var src = el.currentSrc || el.src;
        if (!src || hostToIgnore(src)) continue;
        var active = isActiveMedia(el);
        var hasGraph = !!(el.audiocontext && el.creategain && el.source);
        var gain = getGraphGain(el);
        if (active) activeCount++;
        if (hasGraph) graphCount++;
        if (active && hasGraph) activeGraphCount++;

        if (!active && hasGraph && gain !== 0) {
            anomalies.push("inactive graph had non-zero gain");
            debugLog("watchdog silencing inactive graph", getMediaDebugState(el, i));
            el.creategain.gain.value = 0;
        }

        var desiredGain = getDesiredGraphGain(el);
        if (active && hasGraph && Math.abs((gain || 0) - desiredGain) > 0.001) {
            anomalies.push("active graph gain mismatch");
            debugLog("watchdog correcting active graph gain", {
                state: getMediaDebugState(el, i),
                expectedGain: desiredGain,
                addonMultiplier: multiplier
            });
            el.creategain.gain.value = desiredGain;
        }

        if (active && multiplier > 1 && !hasGraph && !isCrossOriginNoCors(el)) {
            anomalies.push("active boostable media missing graph");
            debugLog("watchdog found active boostable media without graph", getMediaDebugState(el, i));
            scheduleApply();
        }

        if (active && hasGraph && getAudioContextState(el) === 'suspended') {
            anomalies.push("active graph context suspended");
            debugLog("watchdog resuming suspended active graph", getMediaDebugState(el, i));
            try { el.audiocontext.resume(); } catch (e) {
                debugLog("watchdog resume failed", { error: String(e), state: getMediaDebugState(el, i) });
            }
        }

        states.push(getMediaDebugState(el, i));
    }

    if (states.length > 0) {
        debugLog("watchdog media state", {
            multiplier: multiplier,
            mediaCount: media.length,
            trackedMediaCount: states.length,
            activeCount: activeCount,
            graphCount: graphCount,
            activeGraphCount: activeGraphCount,
            anomalies: anomalies,
            pageHidden: document.hidden,
            pageHasFocus: document.hasFocus(),
            youtubePlayerVolume: readYouTubePlayerVolume(),
            locationHref: location.href,
            states: states
        });
    }

    if (activeGraphCount > 1) {
        debugLog("watchdog warning: multiple active gain graphs", {
            multiplier: multiplier,
            activeGraphCount: activeGraphCount,
            states: states
        });
    }
}

var scheduleApplyTimer = null;

function scheduleApply() {
    if (scheduleApplyTimer) clearTimeout(scheduleApplyTimer);
    scheduleApplyTimer = setTimeout(function() {
        scheduleApplyTimer = null;
        window.prevSoundVolume = window.localSoundVolume;
        changeSoundVolume(window.document);
    }, 150);
}

function applyVolume(vol) {
    window.localSoundVolume = normalizeSoundVolume(vol);
    debugLog("applyVolume requested", {
        requestedVolume: vol,
        normalizedVolume: window.localSoundVolume,
        multiplier: getAddonMultiplier()
    });
    if (scheduleApplyTimer) clearTimeout(scheduleApplyTimer);
    scheduleApplyTimer = null;
    window.prevSoundVolume = window.localSoundVolume;
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
        window._svUserHasSetVolume = true;
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
        window._svUserHasSetVolume = true;
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

function observeMedia(doc) {
    var media = doc.querySelectorAll('video, audio');
    var hadNew = false;
    for (var i = 0; i < media.length; i++) {
        var el = media[i];
        if (el.__svObserved) continue;
        el.__svObserved = true;
        hadNew = true;
        rememberBaseState(el);
        el.addEventListener('play', scheduleApply);
        el.addEventListener('volumechange', function() { onPageVolumeChange(this); });
    }
    return hadNew;
}

function loadSavedVolumeAndApply() {
    try {
        _browser().runtime.sendMessage({ action: 'getVolumeForTab' }, function(resp) {
            if (_browser().runtime.lastError) {
                scheduleApply();
                return;
            }
            if (resp && resp.soundVolume !== undefined) {
                window.localSoundVolume = normalizeSoundVolume(resp.soundVolume);
            }
        debugLog("loaded saved tab volume", {
            response: resp || null,
            localSoundVolume: window.localSoundVolume,
            multiplier: getAddonMultiplier()
        });
            scheduleApply();
        });
    } catch (e) {
        scheduleApply();
    }
}

function startMediaWatchdog() {
    if (window.__svMediaWatchdogTimer) return;
    window.__svMediaWatchdogTimer = setInterval(monitorMediaState, 500);
    debugLog("started media watchdog", { intervalMs: 500 });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        observeMedia(document);
        loadSavedVolumeAndApply();
        startMediaWatchdog();
    });
} else {
    observeMedia(document);
    loadSavedVolumeAndApply();
    startMediaWatchdog();
}

var observer = new MutationObserver(function() {
    if (observeMedia(document)) scheduleApply();
});
observer.observe(document.documentElement, {childList: true, subtree: true});
