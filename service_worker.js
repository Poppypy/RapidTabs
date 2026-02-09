const MSG_TYPE = "RAPIDTABS_GESTURE";
const CLOSED_KEY = "rt_closed_tabs";
const CLOSED_LIMIT = 20;

function storageArea() {
  return chrome.storage && chrome.storage.session ? chrome.storage.session : chrome.storage.local;
}

function storageGet(key, fallback) {
  return new Promise((resolve) => {
    storageArea().get({ [key]: fallback }, (items) => {
      if (chrome.runtime.lastError) return resolve(fallback);
      resolve(items[key]);
    });
  });
}

function storageSet(obj) {
  return new Promise((resolve) => {
    storageArea().set(obj, () => resolve());
  });
}

async function rememberClosedTab(tab) {
  const url = tab && typeof tab.url === "string" ? tab.url : "";
  if (!url) return;
  const title = tab && typeof tab.title === "string" ? tab.title : "";
  const list = await storageGet(CLOSED_KEY, []);
  const next = Array.isArray(list) ? list.slice(0, CLOSED_LIMIT - 1) : [];
  next.unshift({ url, title, ts: Date.now() });
  await storageSet({ [CLOSED_KEY]: next });
}

async function restoreFromMemory() {
  const list = await storageGet(CLOSED_KEY, []);
  if (!Array.isArray(list) || list.length === 0) return false;
  const item = list[0];
  const rest = list.slice(1, CLOSED_LIMIT);
  await storageSet({ [CLOSED_KEY]: rest });
  return new Promise((resolve) => {
    chrome.tabs.create({ url: item.url }, () => resolve(!chrome.runtime.lastError));
  });
}

function lastErrorMessage() {
  return chrome?.runtime?.lastError?.message || "";
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== MSG_TYPE) return;

  const action = message.action;
  const tabId = sender && sender.tab && typeof sender.tab.id === "number" ? sender.tab.id : null;

  if (!tabId) {
    sendResponse({ ok: false, error: "missing sender.tab.id" });
    return;
  }

  const done = (ok, error) => sendResponse({ ok, error: error || "" });

  switch (action) {
    case "CLOSE_TAB": {
      const remove = () => {
        chrome.tabs.remove(tabId, () => {
          const err = lastErrorMessage();
          done(!err, err);
        });
      };
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError) return remove();
        rememberClosedTab(tab).then(remove, remove);
      });
      return true;
    }
    case "STOP_LOADING": {
      if (typeof chrome.tabs.stop !== "function") {
        done(true);
        return;
      }
      chrome.tabs.stop(tabId, () => {
        const err = lastErrorMessage();
        done(!err, err);
      });
      return true;
    }
    case "NEW_TAB": {
      chrome.tabs.create({ url: "chrome://newtab" }, () => {
        const err = lastErrorMessage();
        if (!err) return done(true);
        chrome.tabs.create({ url: "about:blank" }, () => {
          const err2 = lastErrorMessage();
          done(!err2, err2 || err);
        });
      });
      return true;
    }
    case "RESTORE_CLOSED_TAB": {
      if (chrome.sessions && typeof chrome.sessions.restore === "function") {
        chrome.sessions.restore(undefined, (session) => {
          const err = lastErrorMessage();
          if (!err && session) return done(true);
          restoreFromMemory().then((ok) => done(ok, ok ? "" : err || "no closed tab"));
        });
        return true;
      }
      restoreFromMemory().then((ok) => done(ok, ok ? "" : "no closed tab"));
      return true;
    }
    case "RELOAD": {
      chrome.tabs.reload(tabId, () => {
        const err = lastErrorMessage();
        done(!err, err);
      });
      return true;
    }
    case "TAB_LEFT": {
      chrome.tabs.query({ currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError || !tabs || tabs.length < 2) {
          done(false, lastErrorMessage() || "no tabs");
          return;
        }
        const idx = tabs.findIndex((t) => t.id === tabId);
        const target = idx > 0 ? tabs[idx - 1] : tabs[tabs.length - 1];
        chrome.tabs.update(target.id, { active: true }, () => {
          const err = lastErrorMessage();
          done(!err, err);
        });
      });
      return true;
    }
    case "TAB_RIGHT": {
      chrome.tabs.query({ currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError || !tabs || tabs.length < 2) {
          done(false, lastErrorMessage() || "no tabs");
          return;
        }
        const idx = tabs.findIndex((t) => t.id === tabId);
        const target = idx < tabs.length - 1 ? tabs[idx + 1] : tabs[0];
        chrome.tabs.update(target.id, { active: true }, () => {
          const err = lastErrorMessage();
          done(!err, err);
        });
      });
      return true;
    }
    case "CLOSE_ALL_TABS": {
      chrome.tabs.query({ currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError || !tabs) {
          done(false, lastErrorMessage());
          return;
        }
        const otherIds = tabs.filter((t) => t.id !== tabId).map((t) => t.id);
        if (otherIds.length === 0) {
          done(true);
          return;
        }
        chrome.tabs.remove(otherIds, () => {
          const err = lastErrorMessage();
          done(!err, err);
        });
      });
      return true;
    }
    default:
      done(false, `unknown action: ${String(action)}`);
      return;
  }
});
