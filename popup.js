const GESTURE_LABELS = {
  L: "\u2190 \u5DE6\u6ED1", R: "\u2192 \u53F3\u6ED1",
  U: "\u2191 \u4E0A\u6ED1", D: "\u2193 \u4E0B\u6ED1",
  DR: "\u2193\u2192", DL: "\u2193\u2190", RU: "\u2192\u2191", LU: "\u2190\u2191",
  RD: "\u2192\u2193", UL: "\u2191\u2190", UR: "\u2191\u2192", LD: "\u2190\u2193",
  UD: "\u2191\u2193", DU: "\u2193\u2191", LR: "\u2190\u2192", RL: "\u2192\u2190"
};
const ACTION_NAMES = {
  NONE: "\u65E0\u64CD\u4F5C", BACK: "\u540E\u9000", FORWARD: "\u524D\u8FDB",
  SCROLL_UP: "\u5411\u4E0A\u6EDA\u52A8", SCROLL_DOWN: "\u5411\u4E0B\u6EDA\u52A8",
  SCROLL_TOP: "\u6EDA\u52A8\u5230\u9876\u90E8", SCROLL_BOTTOM: "\u6EDA\u52A8\u5230\u5E95\u90E8",
  CLOSE_TAB: "\u5173\u95ED\u6807\u7B7E\u9875", NEW_TAB: "\u65B0\u5EFA\u6807\u7B7E\u9875",
  RESTORE_CLOSED_TAB: "\u6062\u590D\u5173\u95ED\u6807\u7B7E\u9875",
  RELOAD: "\u5237\u65B0", STOP_LOADING: "\u505C\u6B62\u52A0\u8F7D",
  TAB_LEFT: "\u5DE6\u8FB9\u6807\u7B7E\u9875", TAB_RIGHT: "\u53F3\u8FB9\u6807\u7B7E\u9875",
  CLOSE_ALL_TABS: "\u5173\u95ED\u6240\u6709\u6807\u7B7E\u9875"
};
const ORDER = ["L","R","U","D","DR","DL","RU","LU","RD","UL","UR","LD","UD","DU","LR","RL"];
const DEFAULT_MAP = {
  L:"BACK",R:"FORWARD",U:"SCROLL_UP",D:"SCROLL_DOWN",
  DR:"CLOSE_TAB",DL:"STOP_LOADING",RU:"NEW_TAB",LU:"RESTORE_CLOSED_TAB",
  RD:"RELOAD",UL:"TAB_LEFT",UR:"TAB_RIGHT",LD:"CLOSE_ALL_TABS",
  UD:"SCROLL_BOTTOM",DU:"SCROLL_TOP",LR:"CLOSE_TAB",RL:"RESTORE_CLOSED_TAB"
};

chrome.storage.sync.get({ gestureMap: DEFAULT_MAP }, (items) => {
  const map = { ...DEFAULT_MAP, ...(items.gestureMap || {}) };
  const container = document.getElementById("gestureList");
  for (const key of ORDER) {
    const action = map[key];
    if (!action || action === "NONE") continue;
    const div = document.createElement("div");
    div.className = "gesture";
    div.innerHTML = '<span class="gesture-dir"></span><span class="gesture-action"></span>';
    div.querySelector(".gesture-dir").textContent = GESTURE_LABELS[key] || key;
    div.querySelector(".gesture-action").textContent = ACTION_NAMES[action] || action;
    container.appendChild(div);
  }
});

document.getElementById("open-settings").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
  window.close();
});
