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

function adoptPageVolume(mediaElements) {
    if (mediaElements.length === 0) return;
    var first = mediaElements[0];
    var src = first.src || first.currentSrc;
    if (!src || hostToIgnore(src)) return;
    if (isCrossOriginNoCors(first)) return;
    var vol = first.muted ? 0 : Math.round(first.volume * 100);
    vol = Math.max(0, Math.min(100, vol));
    window.localSoundVolume = vol;
    if (window === window.top) {
        _browser().runtime.sendMessage({ action: "reportPageVolume", data: { soundVolume: vol } });
    }
}

function changeSoundVolume(doc) {
    var media = doc.querySelectorAll('video, audio');
    if (!window._svUserHasSetVolume && media.length > 0) {
        adoptPageVolume(media);
        return;
    }
    for (var i = 0; i < media.length; i++) {
        var target = media[i];
        var src = target.src || target.currentSrc;
        if (!src || hostToIgnore(src)) continue;

        if (isCrossOriginNoCors(target)) {
            var vol = Math.min(1, window.localSoundVolume / 100);
            if (target.volume !== vol) target.volume = vol;
            if (window.localSoundVolume === 0) target.muted = true;
            continue;
        }

        if (window.localSoundVolume <= 100) {
            var nativeVol = window.localSoundVolume / 100;
            target.volume = Math.min(1, nativeVol);
            target.muted = (nativeVol === 0);
            if (target.creategain) target.creategain.gain.value = 1;
            continue;
        }

        if (!target.audiocontext) {
            if (target.crossOrigin !== 'anonymous') {
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
                target.volume = 1;
                target.muted = false;
                target.audiocontext = new (window.AudioContext || window.webkitAudioContext)();
                target.creategain = target.audiocontext.createGain();
                target.source = target.audiocontext.createMediaElementSource(target);
                target.source.connect(target.creategain);
                target.creategain.connect(target.audiocontext.destination);
                if (target.audiocontext.state === 'suspended') {
                    target.audiocontext.resume();
                }
            } catch (e) {
                var vol = Math.min(1, window.localSoundVolume / 100);
                if (target.volume !== vol) target.volume = vol;
                if (window.localSoundVolume === 0) target.muted = true;
                continue;
            }
        }
        target.volume = 1;
        target.muted = false;
        if (target.audiocontext && target.audiocontext.state === 'suspended') {
            target.audiocontext.resume();
        }
        target.creategain.gain.value = window.localSoundVolume / 100;
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
    window.localSoundVolume = Number(vol);
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
    if (window._svUserHasSetVolume) return;
    var src = el.src || el.currentSrc;
    if (!src || hostToIgnore(src)) return;
    if (isCrossOriginNoCors(el)) return;
    var vol = el.muted ? 0 : Math.round(el.volume * 100);
    vol = Math.max(0, Math.min(100, vol));
    window.localSoundVolume = vol;
    if (window === window.top) {
        _browser().runtime.sendMessage({ action: "reportPageVolume", data: { soundVolume: vol } });
    }
}

function observeMedia(doc) {
    var media = doc.querySelectorAll('video, audio');
    var hadNew = false;
    for (var i = 0; i < media.length; i++) {
        var el = media[i];
        if (el.__svObserved) continue;
        el.__svObserved = true;
        hadNew = true;
        el.addEventListener('play', scheduleApply);
        el.addEventListener('volumechange', function() { onPageVolumeChange(this); });
    }
    return hadNew;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        observeMedia(document);
        scheduleApply();
    });
} else {
    observeMedia(document);
    scheduleApply();
}

var observer = new MutationObserver(function() {
    if (observeMedia(document)) scheduleApply();
});
observer.observe(document.documentElement, {childList: true, subtree: true});
