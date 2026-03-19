(function () {
    "use strict";

    var api = typeof browser !== "undefined" ? browser : chrome;
    var locale = navigator.language && navigator.language.startsWith("ru") ? "ru" : "en";

    var messages = {
        en: {
            headerTitle: "600% Sound Volume",
            headerDescription: "Control volume of the current tab with the slider below. Switch to any tab playing audio with just one click.",
            volumeLabel: "Volume:",
            tabsLabel: "Tabs playing audio right now",
            noTabsLabel: "No tabs playing audio right now",
            boostBlockedLabel: "This page has cross-origin audio. Volume boost above 100% is not available. Use 0-100% to control volume.",
            if_you_like_message: "If you like the addon we'd appreciate a 5 star rating!",
            if_you_like_before: "If you like the addon we'd appreciate a ",
            if_you_like_link_text: "5 star rating",
            if_you_like_after: "!",
            if_you_like_link_url: "https://addons.mozilla.org/en-US/firefox/addon/600-sound-volume-fixed/",
            ctrl_shift_v_title: "Tip: keyboard shortcut",
            ctrl_shift_v_message: "Ctrl+Shift+6 is a shortcut to open \"600% Sound Volume\".",
            right_after_opening_title: "Tip: use keys 0 - 6 to adjust volume",
            right_after_opening_message: "Right after opening \"600% Sound Volume\" press keys 0 - 6 to change volume from 0 % to 600 % respectively."
        },
        ru: {
            headerTitle: "600% Громкость звука",
            headerDescription: "Регулируйте громкость звука текущей вкладки ползунком. Переключайтесь на любую вкладку со звуком одним кликом.",
            volumeLabel: "Громкость:",
            tabsLabel: "Вкладки со звуком",
            noTabsLabel: "Вкладок со звуком нет",
            boostBlockedLabel: "Аудио на этой странице из другого источника. Усиление выше 100% недоступно. Используйте 0–100% для регулировки громкости.",
            if_you_like_message: "Если нравится расширение — будем благодарны за оценку в 5 звёзд!",
            if_you_like_before: "Если нравится расширение — будем благодарны за оценку в ",
            if_you_like_link_text: "5 звёзд",
            if_you_like_after: "!",
            if_you_like_link_url: "https://addons.mozilla.org/en-US/firefox/addon/600-sound-volume-fixed/",
            ctrl_shift_v_title: "Совет: Сочетание клавиш",
            ctrl_shift_v_message: "Ctrl+Shift+6 - сочетание клавиш для открытия \"600% Громкость звука\".",
            right_after_opening_title: "Совет: используйте клавиши 0 - 6 для регулировки громкости",
            right_after_opening_message: "Сразу после открытия \"600% Громкость звука\" нажимайте клавиши 0 - 6, чтобы изменить громкость с 0 % до 600 % соответственно."
        }
    };

    var t = function (key) {
        return (messages[locale] && messages[locale][key]) || messages.en[key] || key;
    };

    var state = {
        soundVolume: 100,
        darkMode: false,
        audibleTabs: [],
        boostBlocked: false,
        refreshTimerId: null,
        tabActivatedListener: null,
        tabUpdatedListener: null,
        tabRemovedListener: null,
        windowFocusChangedListener: null
    };

    var notifications = [
        { id: "v3za9vcy6rji3kx3t32wzjdqi7ztqmxw", priority: 1, title: "", message: "if_you_like_message", minUsages: 15 },
        { id: "cvifms5exdmqy2g3ar4kzhmxi4zepvvq", priority: 750, title: "ctrl_shift_v_title", message: "ctrl_shift_v_message", minUsages: 3 },
        { id: "h6s5u6eqgjpxwqasujret4vz2pnkj945", priority: 500, title: "right_after_opening_title", message: "right_after_opening_message", minUsages: 7 }
    ];

    function setDarkMode(enabled) {
        state.darkMode = !!enabled;
        document.body.classList.toggle("theme-dark", state.darkMode);
        var button = document.getElementById("theme-toggle");
        if (!button) return;
        button.textContent = state.darkMode ? "Dark mode: On" : "Dark mode: Off";
        button.setAttribute("aria-pressed", state.darkMode ? "true" : "false");
        button.classList.toggle("is-active", state.darkMode);
    }

    function loadDarkModePreference(done) {
        api.storage.local.get({ darkMode: false }, function (data) {
            if (api.runtime.lastError) {
                console.warn(api.runtime.lastError);
                setDarkMode(false);
                if (done) done();
                return;
            }
            setDarkMode(!!data.darkMode);
            if (done) done();
        });
    }

    function persistDarkModePreference() {
        api.storage.local.set({ darkMode: state.darkMode }, function () {
            if (api.runtime.lastError) console.warn(api.runtime.lastError);
        });
    }

    function setSoundVolume(val) {
        state.soundVolume = val;
        var slider = document.getElementById("volume-slider");
        if (slider) slider.value = val;
        var cur = document.getElementById("volume-current");
        if (cur) cur.textContent = t("volumeLabel") + " " + val + " %";
    }

    function setTabMutedState(tabId, vol) {
        if (!api.tabs || !api.tabs.update) return;
        var n = Number(vol);
        if (Number.isFinite(n)) {
            api.tabs.update(tabId, { muted: n === 0 }, function () {
                if (api.runtime.lastError) console.warn(api.runtime.lastError);
            });
        }
    }

    function buildFallbackVolumeScript(vol) {
        var multiplier = Math.max(0, Number(vol) / 100);
        return "(function(){var multiplier=" + multiplier + ";function clamp01(value){var n=Number(value);if(!isFinite(n))return 1;return Math.max(0,Math.min(1,n));}function begin(el){el.__svInternalUpdateCount=(el.__svInternalUpdateCount||0)+1;}function end(el){setTimeout(function(){if(el.__svInternalUpdateCount>0)el.__svInternalUpdateCount--;},0);}function ensureBase(el){if(typeof el.__svBaseVolume!=='number'||!isFinite(el.__svBaseVolume))el.__svBaseVolume=clamp01(el.volume);if(typeof el.__svBaseMuted!=='boolean')el.__svBaseMuted=!!el.muted;}function applyNative(el,volume,muted){var nextVolume=clamp01(volume);var nextMuted=!!muted;begin(el);try{if(el.volume!==nextVolume)el.volume=nextVolume;if(el.muted!==nextMuted)el.muted=nextMuted;}catch(error){}end(el);}var media=document.querySelectorAll('video,audio');for(var i=0;i<media.length;i++){var target=media[i];if(!target)continue;try{ensureBase(target);if(multiplier<=1){applyNative(target,Math.min(1,target.__svBaseVolume*multiplier),target.__svBaseMuted||multiplier===0||target.__svBaseVolume===0);if(target.__svGain)target.__svGain.gain.value=1;}else{applyNative(target,target.__svBaseVolume,target.__svBaseMuted);if(!target.__svCtx){target.__svCtx=new (window.AudioContext||window.webkitAudioContext)();target.__svGain=target.__svCtx.createGain();target.__svSource=target.__svCtx.createMediaElementSource(target);target.__svSource.connect(target.__svGain);target.__svGain.connect(target.__svCtx.destination);}if(target.__svCtx.state==='suspended')target.__svCtx.resume();target.__svGain.gain.value=multiplier;}}catch(error){}}return {gain:multiplier,mediaCount:media.length};})();";
    }

    function applyFallbackVolumeForTab(tabId, vol) {
        if (!api.tabs || !api.tabs.executeScript) {
            setTabMutedState(tabId, vol);
            return;
        }
        var code = buildFallbackVolumeScript(vol);
        api.tabs.executeScript(tabId, { code: code }, function () {
            if (api.runtime.lastError) console.warn(api.runtime.lastError);
            setTabMutedState(tabId, vol);
        });
    }

    function sendToActiveTab(action) {
        api.tabs.query({ currentWindow: true, active: true }, function (tabs) {
            var fallback = function () {
                if (action !== "changeSoundVolume") return;
                applyFallbackVolumeForTab(null, state.soundVolume);
            };
            if (!tabs || !tabs.length || !tabs[0] || tabs[0].id === undefined) {
                fallback();
                return;
            }
            if (action === "changeSoundVolume") {
                setTabMutedState(tabs[0].id, state.soundVolume);
                syncVolumeForTab(tabs[0].id, state.soundVolume);
            }
            var tabId = tabs[0].id;
            var send = function (retry) {
                api.tabs.sendMessage(tabId, { action: action, data: state }, function (resp) {
                    var err = api.runtime.lastError;
                    if (err) {
                        if (!retry && /Receiving end does not exist/i.test(err.message || "") && api.tabs && api.tabs.executeScript) {
                            api.tabs.executeScript(tabId, { file: "js/scripts.js" }, function () {
                                if (api.runtime.lastError) {
                                    console.warn(api.runtime.lastError);
                                    fallback();
                                    return;
                                }
                                send(true);
                            });
                            return;
                        }
                        console.warn(err);
                        fallback();
                        return;
                    }
                });
            };
            try {
                send(false);
            } catch (e) {
                console.warn(e);
                fallback();
            }
        });
    }

    function syncVolumeForTab(tabId, vol) {
        api.runtime.sendMessage({ action: "setVolumeForTab", data: { tabId: tabId, soundVolume: Number(vol) } }, function () {
            if (api.runtime.lastError) console.warn(api.runtime.lastError);
        });
    }

    function updateSoundVolume() {
        api.tabs.query({ currentWindow: true, active: true }, function (tabs) {
            if (!tabs || !tabs.length || !tabs[0] || tabs[0].id === undefined) {
                setSoundVolume(100);
                return;
            }
            var tabId = tabs[0].id;
            api.runtime.sendMessage({ action: "getVolumeForTab", data: { tabId: tabId } }, function (resp) {
                if (api.runtime.lastError) {
                    console.warn(api.runtime.lastError);
                    setSoundVolume(100);
                    return;
                }
                var vol = resp && resp.soundVolume >= 0 ? resp.soundVolume : 100;
                if (state.boostBlocked && vol > 100) vol = 100;
                setSoundVolume(vol);
            });
        });
    }

    function listAudible() {
        api.tabs.query({ audible: true, currentWindow: true }, function (tabs) {
            if (api.runtime.lastError) {
                console.warn(api.runtime.lastError);
                state.audibleTabs = [];
                renderTabs();
                return;
            }
            tabs = Array.isArray(tabs) ? tabs : [];
            if (tabs.length === 0 && state.audibleTabs.length > 0) {
                setTimeout(function () {
                    api.tabs.query({ audible: true, currentWindow: true }, function (retryTabs) {
                        if (api.runtime.lastError) return;
                        retryTabs = Array.isArray(retryTabs) ? retryTabs : [];
                        retryTabs.sort(function (a, b) {
                            return (a.title && b.title) ? a.title.localeCompare(b.title) : 0;
                        });
                        state.audibleTabs = retryTabs;
                        renderTabs();
                    });
                }, 150);
                return;
            }
            tabs.sort(function (a, b) {
                return (a.title && b.title) ? a.title.localeCompare(b.title) : 0;
            });
            state.audibleTabs = tabs;
            renderTabs();
        });
    }

    function checkBoostAvailability(tabId) {
        api.tabs.sendMessage(tabId, { action: "checkBoostAvailability" }, function (resp) {
            if (api.runtime.lastError) {
                if (/Receiving end does not exist/i.test(api.runtime.lastError.message || "") && api.tabs && api.tabs.executeScript) {
                    api.tabs.executeScript(tabId, { file: "js/scripts.js" }, function () {
                        if (api.runtime.lastError) {
                            state.boostBlocked = false;
                            renderBoostMsg();
                            return;
                        }
                        checkBoostAvailability(tabId);
                    });
                    return;
                }
                state.boostBlocked = false;
                renderBoostMsg();
                return;
            }
            state.boostBlocked = resp && resp.blocked;
            if (state.boostBlocked && state.soundVolume > 100) {
                setSoundVolume(100);
                sendToActiveTab("changeSoundVolume");
            }
            renderBoostMsg();
        });
    }

    function refreshPopupState() {
        updateSoundVolume();
        listAudible();
        api.tabs.query({ currentWindow: true, active: true }, function (tabs) {
            if (tabs && tabs.length > 0 && tabs[0] && tabs[0].id !== undefined) {
                checkBoostAvailability(tabs[0].id);
            } else {
                state.boostBlocked = false;
                renderBoostMsg();
            }
        });
    }

    function renderTabs() {
        var list = document.getElementById("tabs-list");
        var title = document.getElementById("tabs-title");
        if (!list || !title) return;
        title.textContent = state.audibleTabs.length ? t("tabsLabel") : t("noTabsLabel");
        while (list.firstChild) list.removeChild(list.firstChild);
        state.audibleTabs.forEach(function (tab) {
            var a = document.createElement("a");
            a.href = "#";
            a.className = "tab";
            a.onclick = function (e) {
                e.preventDefault();
                api.tabs.update(tab.id, { active: true }, function () {
                    refreshPopupState();
                });
            };
            var icon = document.createElement("div");
            icon.className = "tab__item tab__icon";
            var img = document.createElement("img");
            img.className = "tab__icon-image";
            img.src = tab.favIconUrl || "";
            img.alt = "";
            icon.appendChild(img);
            var titleDiv = document.createElement("div");
            titleDiv.className = "tab__item tab__title";
            titleDiv.textContent = tab.title || "";
            a.appendChild(icon);
            a.appendChild(titleDiv);
            list.appendChild(a);
        });
    }

    function renderBoostMsg() {
        var el = document.getElementById("boost-msg");
        if (!el) return;
        if (state.boostBlocked) {
            el.textContent = t("boostBlockedLabel");
            el.style.display = "block";
        } else {
            el.style.display = "none";
        }
    }

    function initNotification() {
        api.storage.local.get({ usageCounter: 0, used: [], permittedToShowBanner: -1 }, function (data) {
            data.usageCounter++;
            api.storage.local.set(data);
            var eligible = notifications.filter(function (n) {
                return n.minUsages < data.usageCounter && !data.used.includes(n.id);
            });
            eligible.sort(function (a, b) {
                return a.priority - b.priority;
            });
            var notif = eligible.length > 0 ? eligible[0] : null;
            var notifEl = document.getElementById("notification");
            var titleEl = document.getElementById("notification-title");
            var msgEl = document.getElementById("notification-message");
            if (notif && msgEl) {
                titleEl.textContent = notif.title ? t(notif.title) : "";
                if (notif.message === "if_you_like_message") {
                    msgEl.textContent = "";
                    msgEl.appendChild(document.createTextNode(t("if_you_like_before")));
                    var link = document.createElement("a");
                    link.href = t("if_you_like_link_url");
                    link.target = "_blank";
                    link.rel = "noopener";
                    link.textContent = t("if_you_like_link_text");
                    link.className = "link link--external";
                    msgEl.appendChild(link);
                    msgEl.appendChild(document.createTextNode(t("if_you_like_after")));
                } else {
                    msgEl.textContent = typeof notif.message === "string" && notif.message in messages.en ? t(notif.message) : notif.message;
                }
                notifEl.classList.add("is-active");
                notifEl.dataset.notificationId = notif.id;
            }
        });
    }

    function closeNotification() {
        var notifEl = document.getElementById("notification");
        var id = notifEl && notifEl.dataset.notificationId;
        notifEl.classList.remove("is-active");
        if (id) {
            api.storage.local.get({ used: [] }, function (data) {
                if (!data.used.includes(id)) {
                    data.used.push(id);
                    api.storage.local.set(data);
                }
            });
        }
    }

    function bindListeners() {
        state.tabActivatedListener = function () {
            refreshPopupState();
        };
        state.tabUpdatedListener = function (id, info) {
            if (info && (info.audible !== undefined || info.status !== undefined)) {
                listAudible();
            }
        };
        state.tabRemovedListener = function () {
            listAudible();
        };
        state.windowFocusChangedListener = function () {
            refreshPopupState();
        };
        if (api.tabs && api.tabs.onActivated) api.tabs.onActivated.addListener(state.tabActivatedListener);
        if (api.tabs && api.tabs.onUpdated) api.tabs.onUpdated.addListener(state.tabUpdatedListener);
        if (api.tabs && api.tabs.onRemoved) api.tabs.onRemoved.addListener(state.tabRemovedListener);
        if (api.windows && api.windows.onFocusChanged) api.windows.onFocusChanged.addListener(state.windowFocusChangedListener);
        state.refreshTimerId = setInterval(refreshPopupState, 1000);
    }

    function unbindListeners() {
        if (state.refreshTimerId) {
            clearInterval(state.refreshTimerId);
            state.refreshTimerId = null;
        }
        if (state.tabActivatedListener && api.tabs && api.tabs.onActivated) {
            api.tabs.onActivated.removeListener(state.tabActivatedListener);
            state.tabActivatedListener = null;
        }
        if (state.tabUpdatedListener && api.tabs && api.tabs.onUpdated) {
            api.tabs.onUpdated.removeListener(state.tabUpdatedListener);
            state.tabUpdatedListener = null;
        }
        if (state.tabRemovedListener && api.tabs && api.tabs.onRemoved) {
            api.tabs.onRemoved.removeListener(state.tabRemovedListener);
            state.tabRemovedListener = null;
        }
        if (state.windowFocusChangedListener && api.windows && api.windows.onFocusChanged) {
            api.windows.onFocusChanged.removeListener(state.windowFocusChangedListener);
            state.windowFocusChangedListener = null;
        }
    }

    function init() {
        document.getElementById("header-title").textContent = t("headerTitle");
        document.getElementById("header-description").textContent = t("headerDescription");
        setSoundVolume(state.soundVolume);
        setDarkMode(false);

        var slider = document.getElementById("volume-slider");
        slider.addEventListener("input", function () {
            var val = Math.max(0, Math.min(600, Number(slider.value)));
            if (state.boostBlocked && val > 100) val = 100;
            setSoundVolume(val);
            sendToActiveTab("changeSoundVolume");
        });
        slider.addEventListener("change", function () {
            var val = Math.max(0, Math.min(600, Number(slider.value)));
            if (state.boostBlocked && val > 100) val = 100;
            setSoundVolume(val);
            sendToActiveTab("changeSoundVolume");
        });

        document.getElementById("btn-mute").onclick = function () {
            if (slider) {
                slider.value = 0;
                slider.dispatchEvent(new Event("input", { bubbles: true }));
            }
        };
        document.getElementById("btn-40").onclick = function () {
            if (slider) {
                slider.value = 40;
                slider.dispatchEvent(new Event("input", { bubbles: true }));
            }
        };
        document.getElementById("btn-100").onclick = function () {
            if (slider) {
                slider.value = 100;
                slider.dispatchEvent(new Event("input", { bubbles: true }));
            }
        };
        document.getElementById("theme-toggle").onclick = function () {
            setDarkMode(!state.darkMode);
            persistDarkModePreference();
        };
        document.getElementById("notification-close").onclick = closeNotification;

        document.addEventListener("keypress", function (e) {
            var n = parseInt(e.key, 10);
            if (isNaN(n) || n < 0 || n > 6) return;
            if (state.boostBlocked) {
                setSoundVolume(n > 1 ? 100 : 100 * n);
            } else {
                setSoundVolume(100 * n);
            }
            sendToActiveTab("changeSoundVolume");
        });

        loadDarkModePreference(function () {
            refreshPopupState();
            bindListeners();
            initNotification();
            if (slider) slider.focus();
        });
    }

    window.addEventListener("unload", unbindListeners);
    init();
})();
