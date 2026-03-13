window.prevSoundVolume = null;
window.localSoundVolume = 100;

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

function changeSoundVolume(doc) {
    var media = doc.querySelectorAll('video, audio');
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
                target.audiocontext = new AudioContext();
                target.creategain = target.audiocontext.createGain();
                target.source = target.audiocontext.createMediaElementSource(target);
                target.source.connect(target.creategain);
                target.creategain.connect(target.audiocontext.destination);
            } catch (e) {
                var vol = Math.min(1, window.localSoundVolume / 100);
                if (target.volume !== vol) target.volume = vol;
                if (window.localSoundVolume === 0) target.muted = true;
                continue;
            }
        }
        if (target.creategain) {
            target.volume = 1;
            target.muted = false;
            var gainVal = window.localSoundVolume / 100;
            if (gainVal !== target.creategain.gain.value) target.creategain.gain.value = gainVal;
        }
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
    if (e.detail && e.detail.volume !== undefined) applyVolume(e.detail.volume);
});

function observeMedia(doc) {
    var media = doc.querySelectorAll('video, audio');
    var hadNew = false;
    for (var i = 0; i < media.length; i++) {
        var el = media[i];
        if (el.__svObserved) continue;
        el.__svObserved = true;
        hadNew = true;
        el.addEventListener('play', scheduleApply);
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
