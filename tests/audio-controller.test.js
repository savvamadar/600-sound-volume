const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const repositoryRoot = path.join(__dirname, "..");
const contentScriptSource = fs.readFileSync(
    path.join(repositoryRoot, "src", "js", "scripts.js"),
    "utf8"
);
const backgroundScriptSource = fs.readFileSync(
    path.join(repositoryRoot, "src", "js", "background.js"),
    "utf8"
);
const popupScriptSource = fs.readFileSync(
    path.join(repositoryRoot, "src", "popup", "js", "popup.js"),
    "utf8"
);
const manifest = JSON.parse(
    fs.readFileSync(path.join(repositoryRoot, "src", "manifest.json"), "utf8")
);

function createTimerHarness() {
    let nextId = 1;
    const timeouts = new Map();
    const intervals = new Map();

    return {
        setTimeout(callback) {
            const id = nextId++;
            timeouts.set(id, callback);
            return id;
        },
        clearTimeout(id) {
            timeouts.delete(id);
        },
        setInterval(callback) {
            const id = nextId++;
            intervals.set(id, callback);
            return id;
        },
        runTimeouts() {
            let passes = 0;
            while (timeouts.size && passes++ < 20) {
                const callbacks = Array.from(timeouts.values());
                timeouts.clear();
                callbacks.forEach((callback) => callback());
            }
            assert.ok(passes < 20, "fake timer queue should settle");
        },
        intervalCallbacks() {
            return Array.from(intervals.values());
        },
        intervalCount() {
            return intervals.size;
        }
    };
}

function createContentHarness() {
    const timers = createTimerHarness();
    const mediaElements = [];
    const documentListeners = new Map();
    const runtimeListeners = [];
    const observers = [];
    const contexts = [];

    class FakeGainNode {
        constructor() {
            this.gain = { value: 1 };
            this.connectCount = 0;
            this.disconnectCount = 0;
            this.connected = false;
        }

        connect() {
            this.connectCount++;
            this.connected = true;
        }

        disconnect() {
            this.disconnectCount++;
            this.connected = false;
        }
    }

    class FakeSourceNode {
        constructor() {
            this.connectCount = 0;
        }

        connect() {
            this.connectCount++;
        }
    }

    class FakeAudioContext {
        constructor() {
            this.state = "running";
            this.destination = {};
            this.resumeCount = 0;
            this.closeCount = 0;
            contexts.push(this);
        }

        createGain() {
            return new FakeGainNode();
        }

        createMediaElementSource(media) {
            if (media.failSourceCreation) {
                throw new Error("forced source creation failure");
            }
            if (media.sourceCreateCount) {
                throw new Error("media element already has a source");
            }
            media.sourceCreateCount++;
            return new FakeSourceNode();
        }

        resume() {
            this.resumeCount++;
            this.state = "running";
            return Promise.resolve();
        }

        close() {
            this.closeCount++;
            this.state = "closed";
            return Promise.resolve();
        }
    }

    const document = {
        readyState: "complete",
        hidden: false,
        documentElement: {
            contains(element) {
                return element.isConnected;
            }
        },
        querySelectorAll(selector) {
            assert.equal(selector, "video, audio");
            return mediaElements.filter((element) => element.isConnected);
        },
        addEventListener(type, listener) {
            if (!documentListeners.has(type)) documentListeners.set(type, []);
            documentListeners.get(type).push(listener);
        },
        hasFocus() {
            return true;
        },
        createElement() {
            return {};
        }
    };

    class FakeMediaElement {
        constructor(options = {}) {
            this.nodeType = 1;
            this.ownerDocument = document;
            this.isConnected = options.isConnected !== false;
            this.paused = !!options.paused;
            this.ended = false;
            this.readyState = options.readyState ?? 4;
            this.src = options.src || `blob:fixture-${mediaElements.length + 1}`;
            this.currentSrc = this.src;
            this.crossOrigin = "anonymous";
            this.volume = options.volume ?? 1;
            this.muted = !!options.muted;
            this.currentTime = 1;
            this.duration = 60;
            this.sourceCreateCount = 0;
            this.failSourceCreation = !!options.failSourceCreation;
            this.listeners = new Map();
            mediaElements.push(this);
        }

        addEventListener(type, listener) {
            if (!this.listeners.has(type)) this.listeners.set(type, []);
            this.listeners.get(type).push(listener);
        }

        emit(type) {
            (this.listeners.get(type) || []).forEach((listener) => listener.call(this));
        }

        matches(selector) {
            return selector === "video, audio";
        }

        querySelectorAll() {
            return [];
        }

        setAttribute(name, value) {
            if (name === "crossorigin") this.crossOrigin = value;
        }

        play() {
            this.paused = false;
            return Promise.resolve();
        }
    }

    class FakeMutationObserver {
        constructor(callback) {
            this.callback = callback;
            observers.push(this);
        }

        observe() {}
    }

    const chrome = {
        runtime: {
            lastError: null,
            onMessage: {
                addListener(listener) {
                    runtimeListeners.push(listener);
                }
            },
            sendMessage(request, callback) {
                assert.equal(request.action, "getVolumeForTab");
                callback({ soundVolume: 100 });
            }
        }
    };

    const window = {
        AudioContext: FakeAudioContext,
        document
    };
    window.window = window;

    const context = vm.createContext({
        Array,
        console: { log() {}, warn() {} },
        chrome,
        document,
        location: { href: "https://www.youtube.com/watch?v=fixture" },
        MutationObserver: FakeMutationObserver,
        Number,
        setInterval: timers.setInterval,
        setTimeout: timers.setTimeout,
        clearTimeout: timers.clearTimeout,
        window
    });

    function install() {
        vm.runInContext(contentScriptSource, context, { filename: "scripts.js" });
    }

    function dispatchVolume(volume) {
        const listeners = documentListeners.get("sv-volume-set") || [];
        assert.equal(listeners.length, 1);
        listeners[0]({ detail: { volume } });
    }

    return {
        context,
        contexts,
        createMedia(options) {
            return new FakeMediaElement(options);
        },
        dispatchVolume,
        documentListenerCount(type) {
            return (documentListeners.get(type) || []).length;
        },
        install,
        mutationCallback() {
            assert.equal(observers.length, 1);
            return observers[0].callback;
        },
        observerCount() {
            return observers.length;
        },
        runtimeListenerCount() {
            return runtimeListeners.length;
        },
        timers
    };
}

test("detached boosted media stays silent after the safety monitor runs", () => {
    const harness = createContentHarness();
    const oldPlayer = harness.createMedia({ volume: 0.2 });

    harness.install();
    harness.timers.runTimeouts();
    harness.dispatchVolume(600);

    assert.equal(oldPlayer.creategain.gain.value, 6);
    assert.equal(oldPlayer.volume, 0.2, "page volume must not be multiplied into graph gain");
    assert.equal(oldPlayer.sourceCreateCount, 1);
    assert.equal(oldPlayer.creategain.connectCount, 1);

    oldPlayer.isConnected = false;
    harness.mutationCallback()([{ removedNodes: [oldPlayer] }]);

    assert.equal(oldPlayer.creategain.gain.value, 0);
    assert.equal(oldPlayer.creategain.connected, false);
    assert.equal(oldPlayer.__svGraphConnected, false);

    const safetyMonitor = harness.timers.intervalCallbacks()[0];
    assert.equal(typeof safetyMonitor, "function");
    safetyMonitor();

    assert.equal(oldPlayer.creategain.gain.value, 0);
    assert.equal(oldPlayer.creategain.connected, false);
    assert.equal(oldPlayer.creategain.connectCount, 1);
});

test("a detached media element reuses its graph when reattached", () => {
    const harness = createContentHarness();
    const oldPlayer = harness.createMedia({ volume: 0.5 });

    harness.install();
    harness.timers.runTimeouts();
    harness.dispatchVolume(1000);

    oldPlayer.isConnected = false;
    harness.mutationCallback()([{ removedNodes: [oldPlayer] }]);

    const replacement = harness.createMedia({ volume: 0.5 });
    harness.mutationCallback()([{ removedNodes: [], addedNodes: [replacement] }]);
    harness.timers.runTimeouts();

    assert.equal(replacement.creategain.gain.value, 10);
    assert.equal(oldPlayer.creategain.gain.value, 0);
    assert.equal(harness.contexts.length, 2);

    oldPlayer.isConnected = true;
    harness.mutationCallback()([{ removedNodes: [], addedNodes: [oldPlayer] }]);
    harness.timers.runTimeouts();

    assert.equal(oldPlayer.creategain.gain.value, 10);
    assert.equal(oldPlayer.creategain.connected, true);
    assert.equal(oldPlayer.creategain.connectCount, 2);
    assert.equal(oldPlayer.sourceCreateCount, 1);
    assert.equal(harness.contexts.length, 2, "reattachment must not allocate another context");
});

test("content controller installation and volume bounds are idempotent", () => {
    const harness = createContentHarness();
    const player = harness.createMedia({ volume: 0.1 });

    harness.install();
    harness.timers.runTimeouts();
    harness.install();
    harness.dispatchVolume(5000);

    assert.equal(player.creategain.gain.value, 10);
    assert.equal(harness.runtimeListenerCount(), 1);
    assert.equal(harness.documentListenerCount("sv-volume-set"), 1);
    assert.equal(harness.observerCount(), 1);
    assert.equal(harness.timers.intervalCount(), 1);
});

test("failed graph creation is atomic and is not retried by the safety monitor", () => {
    const harness = createContentHarness();
    const player = harness.createMedia({ failSourceCreation: true });

    harness.install();
    harness.timers.runTimeouts();
    harness.dispatchVolume(600);

    assert.equal(player.audiocontext, undefined);
    assert.equal(player.creategain, undefined);
    assert.equal(player.source, undefined);
    assert.equal(harness.contexts.length, 1);
    assert.equal(harness.contexts[0].state, "closed");

    harness.timers.intervalCallbacks()[0]();
    harness.timers.runTimeouts();
    assert.equal(harness.contexts.length, 1);
});

test("background clamps to 1000 and supports callback-only Chrome MV2 injection", () => {
    let runtimeListener;
    let executeScriptCall;
    const window = {};
    const chrome = {
        browserAction: {
            setBadgeText() {}
        },
        runtime: {
            lastError: null,
            onMessage: {
                addListener(listener) {
                    runtimeListener = listener;
                }
            }
        },
        tabs: {
            executeScript(tabId, details, callback) {
                executeScriptCall = { tabId, details };
                callback();
                return undefined;
            },
            get(tabId, callback) {
                callback({ id: tabId, url: "https://example.com/watch" });
            },
            onRemoved: { addListener() {} },
            onUpdated: { addListener() {} },
            query(query, callback) {
                callback([{ id: 7 }]);
            }
        }
    };
    const document = {
        createElement() {
            let parsed = new URL("https://example.com");
            return {
                get href() {
                    return parsed.href;
                },
                set href(value) {
                    parsed = new URL(value);
                },
                get origin() {
                    return parsed.origin;
                },
                get protocol() {
                    return parsed.protocol;
                },
                get host() {
                    return parsed.host;
                }
            };
        }
    };

    vm.runInNewContext(backgroundScriptSource, {
        chrome,
        console: { log() {} },
        document,
        Number,
        setInterval() {},
        window
    });

    assert.equal(typeof runtimeListener, "function");
    assert.doesNotThrow(() => {
        runtimeListener(
            { action: "setVolumeForTab", data: { tabId: 7, soundVolume: 5000 } },
            {},
            () => {}
        );
    });
    assert.equal(window.latestVolumes[7], 1000);
    assert.equal(executeScriptCall.tabId, 7);
    assert.equal(executeScriptCall.details.allFrames, true);
    assert.match(executeScriptCall.details.code, /volume:1000/);
});

test("popup has no independent Web Audio fallback graph", () => {
    assert.doesNotMatch(popupScriptSource, /createMediaElementSource/);
    assert.doesNotMatch(popupScriptSource, /buildFallbackVolumeScript/);
    assert.doesNotMatch(popupScriptSource, /__sv(?:Ctx|Gain|Source)/);
});

test("release metadata is current and production sources contain no console logging", () => {
    assert.equal(manifest.version, "1.0.13");
    for (const source of [contentScriptSource, backgroundScriptSource, popupScriptSource]) {
        assert.doesNotMatch(source, /console\./);
        assert.doesNotMatch(source, /debugLog/);
    }
});
