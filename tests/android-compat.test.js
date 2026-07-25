const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const repositoryRoot = path.join(__dirname, "..");
const manifest = JSON.parse(
    fs.readFileSync(path.join(repositoryRoot, "src", "manifest.json"), "utf8")
);
const backgroundScriptSource = fs.readFileSync(
    path.join(repositoryRoot, "src", "js", "background.js"),
    "utf8"
);
const popupScriptSource = fs.readFileSync(
    path.join(repositoryRoot, "src", "popup", "js", "popup.js"),
    "utf8"
);

function createEvent() {
    const listeners = [];

    return {
        addListener(listener) {
            listeners.push(listener);
        },
        removeListener(listener) {
            const index = listeners.indexOf(listener);
            if (index >= 0) listeners.splice(index, 1);
        },
        emit(...args) {
            for (const listener of [...listeners]) listener(...args);
        }
    };
}

function createStorageArea(backingStore) {
    function resolveDefaults(keys) {
        if (keys == null) return { ...backingStore };
        if (typeof keys === "string") {
            return Object.hasOwn(backingStore, keys)
                ? { [keys]: backingStore[keys] }
                : {};
        }
        if (Array.isArray(keys)) {
            return Object.fromEntries(
                keys
                    .filter((key) => Object.hasOwn(backingStore, key))
                    .map((key) => [key, backingStore[key]])
            );
        }
        return { ...keys, ...backingStore };
    }

    return {
        get(keys, callback) {
            const result = resolveDefaults(keys);
            if (callback) callback(result);
            return Promise.resolve(result);
        },
        set(values, callback) {
            Object.assign(backingStore, structuredClone(values));
            if (callback) callback();
            return Promise.resolve();
        },
        remove(keys, callback) {
            for (const key of Array.isArray(keys) ? keys : [keys]) {
                delete backingStore[key];
            }
            if (callback) callback();
            return Promise.resolve();
        }
    };
}

function createAnchorDocument() {
    return {
        createElement() {
            let parsed = new URL("https://example.com/");
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
}

function createBackgroundHarness(sharedStorage = {}, options = {}) {
    let runtimeListener;
    const tabRemoved = createEvent();
    const tabUpdated = createEvent();
    const tabActivated = createEvent();
    const storageArea = createStorageArea(sharedStorage);
    const api = {
        runtime: {
            lastError: null,
            onMessage: {
                addListener(listener) {
                    runtimeListener = listener;
                }
            }
        },
        storage: {
            local: storageArea,
            session: storageArea
        },
        tabs: {
            executeScript(tabId, details, callback) {
                if (callback) callback();
                return Promise.resolve([]);
            },
            get(tabId, callback) {
                const tab = {
                    id: tabId,
                    url: options.tabUrl || "https://m.youtube.com/watch?v=fixture"
                };
                if (callback) callback(tab);
                return Promise.resolve(tab);
            },
            onActivated: tabActivated,
            onRemoved: tabRemoved,
            onUpdated: tabUpdated,
            query(query, callback) {
                const tabs = [{
                    id: 41,
                    url: options.tabUrl || "https://m.youtube.com/watch?v=fixture"
                }];
                if (callback) callback(tabs);
                return Promise.resolve(tabs);
            }
        }
        // Firefox for Android may omit desktop-only windows and badge APIs.
    };
    const window = {};

    assert.doesNotThrow(() => {
        vm.runInNewContext(backgroundScriptSource, {
            browser: api,
            document: createAnchorDocument(),
            Number,
            setTimeout,
            URL,
            window
        });
    });

    assert.equal(typeof runtimeListener, "function");

    function sendMessage(message, sender = {}) {
        return new Promise((resolve, reject) => {
            let settled = false;
            const timer = setTimeout(() => {
                if (!settled) reject(new Error(`No response for ${message.action}`));
            }, 100);
            const sendResponse = (response) => {
                settled = true;
                clearTimeout(timer);
                resolve(response);
            };

            const result = runtimeListener(message, sender, sendResponse);
            if (result && typeof result.then === "function") {
                result.then(sendResponse, reject);
            }
        });
    }

    return {
        api,
        sendMessage,
        sharedStorage,
        tabRemoved,
        tabUpdated,
        window
    };
}

class FakeClassList {
    add() {}
    remove() {}
    toggle() {}
}

class FakeElement {
    constructor(tagName = "div") {
        this.tagName = tagName.toUpperCase();
        this.children = [];
        this.classList = new FakeClassList();
        this.dataset = {};
        this.style = {};
        this.textContent = "";
        this.value = "100";
        this.firstChild = null;
    }

    addEventListener(type, listener) {
        this[`on${type}`] = listener;
    }

    appendChild(child) {
        this.children.push(child);
        this.firstChild = this.children[0] || null;
        return child;
    }

    removeChild(child) {
        const index = this.children.indexOf(child);
        if (index >= 0) this.children.splice(index, 1);
        this.firstChild = this.children[0] || null;
        return child;
    }

    setAttribute() {}
    focus() {}
}

function createPopupHarness() {
    const elements = new Map();
    const runtimeMessages = [];
    const tabUpdates = [];
    const storedPreferences = {};
    const tabActivated = createEvent();
    const tabUpdated = createEvent();
    const tabRemoved = createEvent();

    const document = {
        body: new FakeElement("body"),
        addEventListener() {},
        createElement(tagName) {
            return new FakeElement(tagName);
        },
        createTextNode(text) {
            return { textContent: text };
        },
        getElementById(id) {
            if (!elements.has(id)) elements.set(id, new FakeElement());
            return elements.get(id);
        }
    };
    const storageArea = createStorageArea(storedPreferences);
    const api = {
        runtime: {
            lastError: null,
            sendMessage(message, callback) {
                runtimeMessages.push(message);
                const response = message.action === "getVolumeForTab"
                    ? { soundVolume: 100 }
                    : {};
                if (callback) callback(response);
                return Promise.resolve(response);
            }
        },
        storage: {
            local: storageArea
        },
        tabs: {
            onActivated: tabActivated,
            onRemoved: tabRemoved,
            onUpdated: tabUpdated,
            query(query, callback) {
                const tabs = query.audible
                    ? []
                    : [{ id: 41, url: "https://m.youtube.com/watch?v=fixture" }];
                if (callback) callback(tabs);
                return Promise.resolve(tabs);
            },
            sendMessage(tabId, message, callback) {
                if (callback) callback({ blocked: false });
                return Promise.resolve({ blocked: false });
            },
            update(tabId, details, callback) {
                tabUpdates.push({ tabId, details });
                if (callback) callback({ id: tabId, ...details });
                return Promise.resolve({ id: tabId, ...details });
            }
        }
        // Deliberately no windows namespace.
    };
    const window = {
        addEventListener() {}
    };

    assert.doesNotThrow(() => {
        vm.runInNewContext(popupScriptSource, {
            Array,
            browser: api,
            clearInterval() {},
            document,
            isNaN,
            navigator: { language: "en-US" },
            Number,
            parseInt,
            setInterval() {
                return 1;
            },
            setTimeout(callback) {
                callback();
                return 1;
            },
            window
        });
    });

    return { api, document, elements, runtimeMessages, tabUpdates };
}

function flushAsyncWork() {
    return new Promise((resolve) => setImmediate(resolve));
}

test("manifest explicitly targets Firefox for Android as an event page", () => {
    assert.ok(
        manifest.browser_specific_settings
        && manifest.browser_specific_settings.gecko_android,
        "AMO requires browser_specific_settings.gecko_android to advertise Android support"
    );
    assert.equal(
        manifest.browser_specific_settings.gecko_android.strict_min_version,
        "142.0"
    );
    assert.equal(
        manifest.background.persistent,
        false,
        "mobile-compatible MV2 background logic should be an event page"
    );
});

test("manifest does not advertise the unsupported Android keyboard command", () => {
    assert.equal(manifest.commands, undefined);
});

test("background starts without desktop-only windows or badge APIs", () => {
    createBackgroundHarness();
});

test("event-page restart recovers a tab volume and tab removal clears it", async () => {
    const persisted = {};
    const firstRun = createBackgroundHarness(persisted);

    await firstRun.sendMessage({
        action: "setVolumeForTab",
        data: { tabId: 41, soundVolume: 680 }
    });
    await flushAsyncWork();

    const restarted = createBackgroundHarness(persisted);
    const recovered = await restarted.sendMessage({
        action: "getVolumeForTab",
        data: { tabId: 41 }
    });
    assert.equal(recovered && recovered.soundVolume, 680);

    restarted.tabRemoved.emit(41);
    await flushAsyncWork();

    const afterRemoval = createBackgroundHarness(persisted);
    const cleared = await afterRemoval.sendMessage({
        action: "getVolumeForTab",
        data: { tabId: 41 }
    });
    assert.equal(cleared && cleared.soundVolume, 100);
});

test("event-page recovery rejects a persisted volume from another origin", async () => {
    const persisted = {};
    const youtubeRun = createBackgroundHarness(persisted);

    await youtubeRun.sendMessage({
        action: "setVolumeForTab",
        data: { tabId: 41, soundVolume: 720 }
    });
    await flushAsyncWork();

    const navigatedRun = createBackgroundHarness(persisted, {
        tabUrl: "https://example.com/video"
    });
    const recovered = await navigatedRun.sendMessage({
        action: "getVolumeForTab",
        data: { tabId: 41 }
    });

    assert.equal(recovered && recovered.soundVolume, 100);
});

test("popup starts without windows and mute uses extension audio, not tabs.update muted", () => {
    const popup = createPopupHarness();

    popup.elements.get("btn-mute").onclick();

    const volumeUpdate = popup.runtimeMessages.find(
        (message) => message.action === "setVolumeForTab"
    );
    assert.deepEqual(
        JSON.parse(JSON.stringify(volumeUpdate)),
        {
            action: "setVolumeForTab",
            data: {
                tabId: 41,
                soundVolume: 0,
                url: "https://m.youtube.com/watch?v=fixture"
            }
        }
    );
    assert.equal(
        popup.tabUpdates.some((update) => Object.hasOwn(update.details, "muted")),
        false,
        "tabs.update muted is unavailable on Firefox for Android"
    );
    assert.doesNotMatch(popupScriptSource, /\bmuted\s*:/);
});
