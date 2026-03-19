window.prevSoundVolume = null;
window.localSoundVolume = 100;
window._svUserHasSetVolume = false;

const HOSTS_TO_IGNORE = [];

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
}

function endInternalMediaUpdate(el) {
    setTimeout(function() {
        if (el.__svInternalUpdateCount > 0) el.__svInternalUpdateCount--;
    }, 0);
}

function isInternalMediaUpdate(el) {
    return !!el.__svInternalUpdateCount;
}

function rememberBaseState(el) {
    if (!el || isInternalMediaUpdate(el)) return;
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

function getEffectiveVolume(el) {
    var doc = (window.top && window.top.document) || document;
    try {
        var script = doc.createElement('script');
        script.textContent = '(function(){try{var p=document.getElementById("movie_player");if(p&&typeof p.getVolume==="function"){var v=p.getVolume();document.documentElement.setAttribute("data-sv-yt-vol",typeof v==="number"&&v>=0?String(Math.min(100,v)):"");}else{document.documentElement.removeAttribute("data-sv-yt-vol");}}catch(e){document.documentElement.removeAttribute("data-sv-yt-vol");}})();';
        (doc.head || doc.documentElement).appendChild(script);
        script.remove();
    } catch (e) {}
    var ytVol = doc.documentElement.getAttribute('data-sv-yt-vol');
    if (ytVol !== null && ytVol !== '') {
        var v = parseFloat(ytVol) / 100;
        if (Number.isFinite(v)) return Math.max(0, Math.min(1, v));
    }
    return el.muted ? 0 : el.volume;
}

function getPageVolumeFactor(el) {
    var effectiveVolume = clampUnit(getEffectiveVolume(el));
    var nativeVolume = el.muted ? 0 : clampUnit(el.volume);
    if (effectiveVolume === 0 || el.muted) return 0;
    if (nativeVolume <= 0) return 0;
    return effectiveVolume / nativeVolume;
}

function applyDirectMultiplier(target) {
    ensureBaseState(target);
    var multiplier = getAddonMultiplier();
    var volume = Math.min(1, target.__svBaseVolume * multiplier);
    var muted = target.__svBaseMuted || multiplier === 0 || target.__svBaseVolume === 0;
    applyNativeState(target, volume, muted);
    if (target.creategain) target.creategain.gain.value = 1;
}

function ensureAudioContext(target, src) {
    if (target.audiocontext && target.creategain && target.source) {
        if (target.audiocontext.state === 'suspended') {
            target.audiocontext.resume();
        }
        return true;
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
        return false;
    }
}

function changeSoundVolume(doc) {
    var media = doc.querySelectorAll('video, audio');
    for (var i = 0; i < media.length; i++) {
        var target = media[i];
        var src = target.src || target.currentSrc;
        if (!src || hostToIgnore(src)) continue;
        ensureBaseState(target);

        if (isCrossOriginNoCors(target)) {
            applyDirectMultiplier(target);
            continue;
        }

        if (!ensureAudioContext(target, src)) {
            applyDirectMultiplier(target);
            continue;
        }

        target.creategain.gain.value = getAddonMultiplier() * getPageVolumeFactor(target);
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
            scheduleApply();
        });
    } catch (e) {
        scheduleApply();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        observeMedia(document);
        loadSavedVolumeAndApply();
    });
} else {
    observeMedia(document);
    loadSavedVolumeAndApply();
}

var observer = new MutationObserver(function() {
    if (observeMedia(document)) scheduleApply();
});
observer.observe(document.documentElement, {childList: true, subtree: true});
