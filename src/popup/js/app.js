(function (t) {
    function e(e) {
        for (var i, s, r = e[0], l = e[1], u = e[2], d = 0, f = []; d < r.length; d++) s = r[d], Object.prototype.hasOwnProperty.call(a, s) && a[s] && f.push(a[s][0]), a[s] = 0;
        for (i in l) Object.prototype.hasOwnProperty.call(l, i) && (t[i] = l[i]);
        c && c(e);
        while (f.length) f.shift()();
        return o.push.apply(o, u || []), n()
    }

    function n() {
        for (var t, e = 0; e < o.length; e++) {
            for (var n = o[e], i = !0, r = 1; r < n.length; r++) {
                var l = n[r];
                0 !== a[l] && (i = !1)
            }
            i && (o.splice(e--, 1), t = s(s.s = n[0]))
        }
        return t
    }

    var i = {}, a = {app: 0}, o = [];

    function s(e) {
        if (i[e]) return i[e].exports;
        var n = i[e] = {i: e, l: !1, exports: {}};
        return t[e].call(n.exports, n, n.exports, s), n.l = !0, n.exports
    }

    s.m = t, s.c = i, s.d = function (t, e, n) {
        s.o(t, e) || Object.defineProperty(t, e, {enumerable: !0, get: n})
    }, s.r = function (t) {
        "undefined" !== typeof Symbol && Symbol.toStringTag && Object.defineProperty(t, Symbol.toStringTag, {value: "Module"}), Object.defineProperty(t, "__esModule", {value: !0})
    }, s.t = function (t, e) {
        if (1 & e && (t = s(t)), 8 & e) return t;
        if (4 & e && "object" === typeof t && t && t.__esModule) return t;
        var n = Object.create(null);
        if (s.r(n), Object.defineProperty(n, "default", {
            enumerable: !0,
            value: t
        }), 2 & e && "string" != typeof t) for (var i in t) s.d(n, i, function (e) {
            return t[e]
        }.bind(null, i));
        return n
    }, s.n = function (t) {
        var e = t && t.__esModule ? function () {
            return t["default"]
        } : function () {
            return t
        };
        return s.d(e, "a", e), e
    }, s.o = function (t, e) {
        return Object.prototype.hasOwnProperty.call(t, e)
    }, s.p = "";
    var r = window["webpackJsonp"] = window["webpackJsonp"] || [], l = r.push.bind(r);
    r.push = e, r = r.slice();
    for (var u = 0; u < r.length; u++) e(r[u]);
    var c = l;
    o.push([0, "chunk-vendors"]), n()
})({
    0: function (t, e, n) {
        t.exports = n("56d7")
    }, "49f8": function (t, e, n) {
        var i = {"./en.json": "edd4", "./ru.json": "7704"};

        function a(t) {
            var e = o(t);
            return n(e)
        }

        function o(t) {
            if (!n.o(i, t)) {
                var e = new Error("Cannot find module '" + t + "'");
                throw e.code = "MODULE_NOT_FOUND", e
            }
            return i[t]
        }

        a.keys = function () {
            return Object.keys(i)
        }, a.resolve = o, t.exports = a, a.id = "49f8"
    }, "56d7": function (t, e, n) {
        "use strict";
        n.r(e);
        n("e260"), n("e6cf"), n("cca6"), n("a79d"), n("2ca0"), n("caad"), n("2532"), n("4de4");
        var i = n("2b0e"), a = function () {
                var t = this, e = t.$createElement, n = t._self._c || e;
                return n("div", {attrs: {id: "app"}}, [n("header", {staticClass: "header"}, [n("h1", {staticClass: "header__name"}, [t._v(t._s(t.$t("headerTitle")))]), n("p", {staticClass: "header__description"}, [t._v(" " + t._s(t.$t("headerDescription")) + " ")])]), n("section", {
                    ref: "notification",
                    staticClass: "notification js-notification",
                    attrs: {id: "notification"}
                }, [n("button", {
                    staticClass: "notification__close js-notification__close",
                    attrs: {tabindex: "-1"},
                    on: {click: t.$parent.buttonNotificationCloseClickHandler}
                }, [t._v("×")]), n("div", {
                    staticClass: "notification__title js-notification__title",
                    attrs: {id: "notification-title"},
                    domProps: {innerHTML: t._s(t.$parent.notificationTitle)}
                }, [t._v(" " + t._s(t.$parent.notificationTitle) + " ")]), n("div", {
                    staticClass: "notification__message js-notification__message",
                    attrs: {id: "notification-message"},
                    domProps: {innerHTML: t._s(t.$parent.notificationMessage)}
                }, [t._v(" " + t._s(t.$parent.notificationMessage) + " ")])]), n("section", {staticClass: "volume-slider"}, [n("button", {on: {click: t.$parent.buttonMuteClickHandler}}, [n("img", {attrs: {src: "mute.png"}})]), n("button", {on: {click: t.$parent.button100ClickHandler}}, [n("span", {staticStyle: {"font-size": "15px"}}, [t._v("100%")]), n("img", {
                    staticStyle: {
                        width: "0px",
                        height: "16px"
                    }, attrs: {src: "mute.png"}
                })]), t.$parent.boostBlocked ? n("span", {staticClass: "volume-slider__boost-msg"}, [t._v(" " + t._s(t.$t("boostBlockedLabel")) + " ")]) : t._e(), n("input", {
                    ref: "volume-slider",
                    staticClass: "volume-slider__slider",
                    attrs: {id: "volume-slider", type: "range", min: "0", max: "600", step: "10", autofocus: ""},
                    domProps: {value: t.$parent.soundVolume},
                    on: {input: t.$parent.soundValueChangeHandler, change: t.$parent.soundValueChangeHandler}
                })]), n("section", {staticClass: "volume-info"}, [n("span", {staticClass: "volume-info__volume-min"}, [t._v("0 %")]), n("span", {staticClass: "volume-info__volume-current"}, [t._v(t._s(t.$t("volumeLabel")) + " " + t._s(t.$parent.soundVolume) + " %")]), n("span", {staticClass: "volume-info__volume-max"}, [t._v("600 %")])]), n("section", {staticClass: "tabs"}, [t.$parent.audibleTabs.length ? n("div", {staticClass: "tabs__title"}, [t._v(t._s(t.$t("tabsLabel")))]) : n("div", {staticClass: "tabs__title"}, [t._v(t._s(t.$t("noTabsLabel")))]), t._l(t.$parent.audibleTabs, (function (e) {
                    return n("div", {key: e.id, staticClass: "tabs__list"}, [n("a", {
                        staticClass: "tab",
                        attrs: {href: "#"},
                        on: {
                            click: function (n) {
                                return t.$parent.audibleTabsClickHandler(e)
                            }
                        }
                    }, [n("div", {staticClass: "tab__item tab__icon"}, [n("img", {
                        staticClass: "tab__icon-image",
                        attrs: {src: e.favIconUrl, alt: ""}
                    })]), n("div", {staticClass: "tab__item tab__title"}, [t._v(t._s(e.title))])])])
                }))], 2), n("footer", {staticStyle: {width: "100%"}}, [n("span", {staticStyle: {float: "left"}}, [n("a", {
                    attrs: {
                        href: "https://github.com/savvamadar/600-sound-volume/",
                        target: "_blank"
                    }
                })])])])
            }, o = [], s = {name: "App"}, r = s, l = n("2877"), u = Object(l["a"])(r, a, o, !1, null, null, null),
            c = u.exports, d = (n("159b"), n("d3b7"), n("ddb0"), n("ac1f"), n("466d"), n("a925"));
        i["a"].use(d["a"]);
        var f = navigator.language;

        function _() {
            var t = n("49f8"), e = {};
            return t.keys().forEach((function (n) {
                var i = n.match(/([A-Za-z0-9-_]+)\./i);
                if (i && i.length > 1) {
                    var a = i[1];
                    e[a] = t(n)
                }
            })), e
        }

        f = f && f.startsWith("ru") ? "ru" : "en";
        var p = new d["a"]({locale: f || "en", fallbackLocale: f || "en", messages: _()});
        i["a"].config.productionTip = !1;
        var m = function () {
            return "undefined" !== typeof window.browser ? window.browser : window.chrome
        }, h = navigator.language;
        h = h && h.startsWith("ru") ? "ru" : "en";
        var b = new i["a"]({
            i18n: p,
            el: "#app",
            data: {
                soundVolume: 100,
                audibleTabs: [],
                tabId: null,
                notificationTitle: null,
                notificationMessage: null,
                notificationId: null,
                refreshTimerId: null,
                tabActivatedListener: null,
                tabUpdatedListener: null,
                tabRemovedListener: null,
                windowFocusChangedListener: null,
                boostBlocked: false,
                notifications: [{
                    id: "v3za9vcy6rji3kx3t32wzjdqi7ztqmxw",
                    priority: 1,
                    title: "",
                    message: p.t("if_you_like_message"),
                    minUsages: 15
                }, {
                    id: "cvifms5exdmqy2g3ar4kzhmxi4zepvvq",
                    priority: 750,
                    title: p.t("ctrl_shift_v_title"),
                    message: p.t("ctrl_shift_v_message"),
                    minUsages: 3
                }, {
                    id: "h6s5u6eqgjpxwqasujret4vz2pnkj945",
                    priority: 500,
                    title: p.t("right_after_opening_title"),
                    message: p.t("right_after_opening_message"),
                    minUsages: 7
                }]
            },
            methods: {
                sendToActiveTab: function (t, e) {
                    m().tabs.query({currentWindow: !0, active: !0}, (function (n) {
                        var a = function () {
                            e && e({soundVolume: 100})
                        };
                        var l = function (e) {
                            if ("changeSoundVolume" !== t) return;
                            b.applyFallbackVolumeForTab(e, b.$data.soundVolume)
                        };
                        if (!n || !n.length || !n[0] || void 0 === n[0].id) {
                            a();
                            return
                        }
                        "changeSoundVolume" === t && b.setTabMutedState(n[0].id, b.$data.soundVolume);
                        "changeSoundVolume" === t && b.syncVolumeForTab(n[0].id, b.$data.soundVolume);
                        var o = n[0].id, s = function (n) {
                            m().tabs.sendMessage(o, {action: t, data: b.$data}, (function (t) {
                                var u = m().runtime.lastError;
                                if (u) {
                                    if (!n && /Receiving end does not exist/i.test(u.message || "") && m().tabs && m().tabs.executeScript) {
                                        m().tabs.executeScript(o, {file: "js/scripts.js"}, (function () {
                                            var t = m().runtime.lastError;
                                            if (t) {
                                                window.lastError = t, window.console.warn(t), l(o), a();
                                                return
                                            }
                                            s(!0)
                                        }));
                                        return
                                    }
                                    window.lastError = u, window.console.warn(u), l(o), a();
                                    return
                                }
                                window.lastError = null, e && e(t)
                            }))
                        };
                        try {
                            s(!1)
                        } catch (i) {
                            window.console.warn(i), a()
                        }
                    }))
                }, setSoundVolume: function (t) {
                    this.soundVolume = t;
                }, setTabMutedState: function (t, e) {
                    if (!m().tabs || !m().tabs.update) return;
                    var n = Number(e);
                    Number.isFinite(n) && m().tabs.update(t, {muted: 0 === n}, (function () {
                        m().runtime.lastError && window.console.warn(m().runtime.lastError)
                    }))
                }, buildFallbackVolumeScript: function (t) {
                    var e = Math.max(0, Number(t) / 100);
                    return "(function(){var gain=" + e + ";var media=document.querySelectorAll('video,audio');for(var i=0;i<media.length;i++){var target=media[i];if(!target)continue;try{if(gain<=1){target.volume=Math.min(1,gain);target.muted=(gain===0);if(target.__svGain){target.__svGain.gain.value=1;}}else{target.muted=false;target.volume=1;if(!target.__svCtx){target.__svCtx=new (window.AudioContext||window.webkitAudioContext)();target.__svGain=target.__svCtx.createGain();target.__svSource=target.__svCtx.createMediaElementSource(target);target.__svSource.connect(target.__svGain);target.__svGain.connect(target.__svCtx.destination);}target.__svGain.gain.value=gain;}}catch(error){}}return {gain:gain,mediaCount:media.length};})();"
                }, applyFallbackVolumeForTab: function (t, e) {
                    var n = this;
                    if (!m().tabs || !m().tabs.executeScript) {
                        this.setTabMutedState(t, e);
                        return
                    }
                    var i = this.buildFallbackVolumeScript(e);
                    m().tabs.executeScript(t, {code: i}, (function () {
                        if (m().runtime.lastError) window.console.warn(m().runtime.lastError);
                        n.setTabMutedState(t, e)
                    }))
                }, soundValueChangeHandler: function (t) {
                    var val = Math.max(0, Math.min(600, Number(t.target.value)));
                    this.boostBlocked && val > 100 && (val = 100);
                    this.setSoundVolume(val), this.sendToActiveTab("changeSoundVolume")
                }, button100ClickHandler: function () {
                    this.setSoundVolume(100), this.sendToActiveTab("changeSoundVolume")
                }, buttonMuteClickHandler: function () {
                    this.setSoundVolume(0), this.sendToActiveTab("changeSoundVolume")
                }, syncVolumeForTab: function (t, e) {
                    m().runtime.sendMessage({action: "setVolumeForTab", data: {tabId: t, soundVolume: Number(e)}}, (function () {
                        m().runtime.lastError && window.console.warn(m().runtime.lastError)
                    }))
                }, buttonNotificationCloseClickHandler: function () {
                    var t = this;
                    document.getElementById("notification").classList.remove("is-active"), m().storage.local.get({
                        installationDate: null,
                        used: []
                    }, (function (e) {
                        t.notificationId && !e.used.includes(t.notificationId) && (e.used.push(t.notificationId), m().storage.local.set(e))
                    }))
                }, audibleTabsClickHandler: function (t) {
                    var e = this;
                    m().tabs.update(t.id, {active: !0}, (function () {
                        e.refreshPopupState()
                    }))
                }, updateSoundVolume: function () {
                    var t = this;
                    m().tabs.query({currentWindow: !0, active: !0}, (function (e) {
                        if (!e || !e.length || !e[0] || void 0 === e[0].id) {
                            t.setSoundVolume(100);
                            return
                        }
                        var n = e[0].id;
                        m().runtime.sendMessage({action: "getVolumeForTab", data: {tabId: n}}, (function (e) {
                            if (m().runtime.lastError) {
                                window.console.warn(m().runtime.lastError), t.setSoundVolume(100);
                                return
                            }
                            var vol = e && e.soundVolume >= 0 ? e.soundVolume : 100;
                            t.boostBlocked && vol > 100 && (vol = 100);
                            t.setSoundVolume(vol)
                        }))
                    }))
                }, refreshPopupState: function () {
                    this.updateSoundVolume(), this.listAudible();
                    var t = this;
                    m().tabs.query({currentWindow: !0, active: !0}, (function (e) {
                        if (e && e.length > 0 && e[0] && e[0].id !== undefined) {
                            t.checkBoostAvailability(e[0].id)
                        } else {
                            t.boostBlocked = false
                        }
                    }))
                }, checkBoostAvailability: function (tabId) {
                    var t = this;
                    m().tabs.sendMessage(tabId, {action: "checkBoostAvailability"}, (function (e) {
                        if (m().runtime.lastError) {
                            if (/Receiving end does not exist/i.test(m().runtime.lastError.message || "") && m().tabs.executeScript) {
                                m().tabs.executeScript(tabId, {file: "js/scripts.js"}, (function () {
                                    if (m().runtime.lastError) {
                                        t.boostBlocked = false;
                                        return
                                    }
                                    t.checkBoostAvailability(tabId)
                                }));
                                return
                            }
                            t.boostBlocked = false;
                            return
                        }
                        t.boostBlocked = e && e.blocked;
                        t.boostBlocked && t.soundVolume > 100 && (t.setSoundVolume(100), t.sendToActiveTab("changeSoundVolume"))
                    }))
                }, listAudible: function () {
                    var t = this;
                    m().tabs.query({audible: !0, currentWindow: !0}, (function (e) {
                        if (m().runtime.lastError) {
                            window.console.warn(m().runtime.lastError), t.audibleTabs = [];
                            return
                        }
                        var n = function (t, e) {
                            return t.title && e.title ? t.title.localeCompare(e.title) : 0
                        };
                        e = Array.isArray(e) ? e : [], e.sort(n), t.audibleTabs = e
                    }))
                }, bindPopupListeners: function () {
                    var t = this;
                    this.unbindPopupListeners(), this.tabActivatedListener = function () {
                        t.refreshPopupState()
                    }, this.tabUpdatedListener = function (e, n) {
                        n && (void 0 !== n.audible || void 0 !== n.status) && t.listAudible()
                    }, this.tabRemovedListener = function () {
                        t.listAudible()
                    }, this.windowFocusChangedListener = function () {
                        t.refreshPopupState()
                    }, m().tabs && m().tabs.onActivated && m().tabs.onActivated.addListener(this.tabActivatedListener), m().tabs && m().tabs.onUpdated && m().tabs.onUpdated.addListener(this.tabUpdatedListener), m().tabs && m().tabs.onRemoved && m().tabs.onRemoved.addListener(this.tabRemovedListener), m().windows && m().windows.onFocusChanged && m().windows.onFocusChanged.addListener(this.windowFocusChangedListener), this.refreshTimerId = window.setInterval((function () {
                        t.refreshPopupState()
                    }), 1e3)
                }, unbindPopupListeners: function () {
                    this.refreshTimerId && (window.clearInterval(this.refreshTimerId), this.refreshTimerId = null), this.tabActivatedListener && m().tabs && m().tabs.onActivated && (m().tabs.onActivated.removeListener(this.tabActivatedListener), this.tabActivatedListener = null), this.tabUpdatedListener && m().tabs && m().tabs.onUpdated && (m().tabs.onUpdated.removeListener(this.tabUpdatedListener), this.tabUpdatedListener = null), this.tabRemovedListener && m().tabs && m().tabs.onRemoved && (m().tabs.onRemoved.removeListener(this.tabRemovedListener), this.tabRemovedListener = null), this.windowFocusChangedListener && m().windows && m().windows.onFocusChanged && (m().windows.onFocusChanged.removeListener(this.windowFocusChangedListener), this.windowFocusChangedListener = null)
                }, initNotification: function () {
                    var t = this;
                    m().storage.local.get({usageCounter: 0, used: [], permittedToShowBanner: -1}, (function (e) {
                        e.usageCounter++, m().storage.local.set(e);
                        var n = t.notifications.filter((function (t) {
                            var n = t.minUsages < e.usageCounter, i = !e.used.includes(t.id);
                            return n && i
                        })), i = n.sort((function (t, e) {
                            return t.priority - e.priority
                        })), a = i.length > 0 ? i[0] : null;
                        t.notificationTitle = a ? a["title"] : null, t.notificationMessage = a ? a["message"] : null, t.notificationId = a ? a.id : null, t.notificationMessage && document.getElementById("notification").classList.add("is-active")
                    }))
                }, init: function () {
                    var t = this;
                    try {
                        this.refreshPopupState(), this.bindPopupListeners(), document.getElementById("volume-slider").focus(), this.initNotification(), document.documentElement.addEventListener("keypress", (function (e) {
                            var n = parseInt(e.key.toLowerCase());
                            n >= 0 && n <= 6 && (t.boostBlocked ? (t.setSoundVolume(n > 1 ? 100 : 100 * n), t.sendToActiveTab("changeSoundVolume")) : (t.setSoundVolume(100 * n), t.sendToActiveTab("changeSoundVolume")))
                        }))
                    } catch (a) {
                        window.console.warn(a)
                    }
                }
            },
            mounted: function () {
                this.init()
            },
            beforeDestroy: function () {
                this.unbindPopupListeners()
            },
            render: function (t) {
                return t(c)
            }
        });
        b.$mount("#app");
    }, 7704: function (t) {
        t.exports = JSON.parse(`{
            "headerTitle": "600% Громкость звука",
            "headerDescription": "Регулируйте громкость звука текущей вкладки ползунком. Переключайтесь на любую вкладку со звуком одним кликом.",
            "volumeLabel": "Громкость:",
            "tabsLabel": "Вкладки со звуком",
            "noTabsLabel": "Вкладок со звуком нет",
            "rateItLabel": "Оценить!",
            "boostBlockedLabel": "Аудио на этой странице из другого источника. Усиление выше 100% недоступно. Используйте 0–100% для регулировки громкости.",
            "if_you_like_title": "",
            "if_you_like_message": "Если нравится расширение — будем благодарны за оценку в 5 звёзд!",
            "ctrl_shift_v_title": "Совет: Сочетание клавиш",
            "ctrl_shift_v_message": "<strong>Ctrl+Shift+6</strong> - сочетание клавиш для открытия \\"600% Громкость звука\\".",
            "right_after_opening_title": "Совет: используйте клавиши 0 - 6 для регулировки громкости",
            "right_after_opening_message": "Сразу после открытия \\"600% Громкость звука\\" нажимайте клавиши 0&nbsp;-&nbsp;6 , чтобы изменить громкость с 0&nbsp;% до 600&nbsp;% соответственно."
        }`);
    }, edd4: function (t) {
        t.exports = JSON.parse(`{
            "headerTitle": "600% Sound Volume",
            "headerDescription": "Control volume of the current tab with the slider below. Switch to any tab playing audio with just one click.",
            "volumeLabel": "Volume:",
            "tabsLabel": "Tabs playing audio right now",
            "noTabsLabel": "No tabs playing audio right now",
            "rateItLabel": "Rate It!",
            "boostBlockedLabel": "This page has cross-origin audio. Volume boost above 100% is not available. Use 0-100% to control volume.",
            "if_you_like_title": "",
            "if_you_like_message": "If you like the addon we'd appreciate a 5 star rating!",
            "ctrl_shift_v_title": "Tip: keyboard shortcut",
            "ctrl_shift_v_message": "<strong>Ctrl+Shift+6</strong> is a shortcut to open \\"600% Sound Volume\\".",
            "right_after_opening_title": "Tip: use keys 0 - 6 to adjust volume",
            "right_after_opening_message": "Right after opening \\"600% Sound Volume\\" press keys 0&nbsp;-&nbsp;6 to change volume from 0&nbsp;% to 600&nbsp;% respectively."
        }`);
    }
});
//# sourceMappingURL=app.js.map
