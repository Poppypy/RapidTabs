const DEFAULT_CONFIG = {
  minSegmentPx: 20,
  minTotalPx: 60,
  maxTimeMs: 1500,
  cardinalToleranceDeg: 30,
  lMinLegPx: 35,
  vMaxAngleDeg: 140,
  vMinLegPx: 50,
  vDiagonalRatioMin: 0.25,
  vVertexMarginPx: 18,
  vRelaxed: true,
  sampleMinPx: 4,
  maxPoints: 512,
  showTrail: true,
  debug: false
};

const DEFAULT_GESTURE_MAP = {
  L: "BACK",
  R: "FORWARD",
  U: "SCROLL_UP",
  D: "SCROLL_DOWN",
  DR: "CLOSE_TAB",
  DL: "STOP_LOADING",
  RU: "NEW_TAB",
  LU: "RESTORE_CLOSED_TAB",
  RD: "RELOAD",
  UL: "TAB_LEFT",
  UR: "TAB_RIGHT",
  LD: "CLOSE_ALL_TABS",
  UD: "SCROLL_BOTTOM",
  DU: "SCROLL_TOP",
  LR: "CLOSE_TAB",
  RL: "RESTORE_CLOSED_TAB"
};

const DIR_ARROW = { U: "\u2191", D: "\u2193", L: "\u2190", R: "\u2192" };

const GESTURE_LABELS = {
  L: { arrow: "\u2190", label: "\u2190 \u5DE6\u6ED1" },
  R: { arrow: "\u2192", label: "\u2192 \u53F3\u6ED1" },
  U: { arrow: "\u2191", label: "\u2191 \u4E0A\u6ED1" },
  D: { arrow: "\u2193", label: "\u2193 \u4E0B\u6ED1" },
  DR: { arrow: "\u2193\u2192", label: "\u2193\u2192" },
  DL: { arrow: "\u2193\u2190", label: "\u2193\u2190" },
  RU: { arrow: "\u2192\u2191", label: "\u2192\u2191" },
  LU: { arrow: "\u2190\u2191", label: "\u2190\u2191" },
  RD: { arrow: "\u2192\u2193", label: "\u2192\u2193" },
  UL: { arrow: "\u2191\u2190", label: "\u2191\u2190" },
  UR: { arrow: "\u2191\u2192", label: "\u2191\u2192" },
  LD: { arrow: "\u2190\u2193", label: "\u2190\u2193" },
  UD: { arrow: "\u2191\u2193", label: "\u2191\u2193" },
  DU: { arrow: "\u2193\u2191", label: "\u2193\u2191" },
  LR: { arrow: "\u2190\u2192", label: "\u2190\u2192" },
  RL: { arrow: "\u2192\u2190", label: "\u2192\u2190" }
};

const GESTURE_ORDER = ["L","R","U","D","DR","DL","RU","LU","RD","UL","UR","LD","UD","DU","LR","RL"];

const ACTION_OPTIONS = [
  { value: "NONE", label: "\u65E0\u64CD\u4F5C" },
  { value: "BACK", label: "\u540E\u9000" },
  { value: "FORWARD", label: "\u524D\u8FDB" },
  { value: "SCROLL_UP", label: "\u5411\u4E0A\u6EDA\u52A8" },
  { value: "SCROLL_DOWN", label: "\u5411\u4E0B\u6EDA\u52A8" },
  { value: "SCROLL_TOP", label: "\u6EDA\u52A8\u5230\u9876\u90E8" },
  { value: "SCROLL_BOTTOM", label: "\u6EDA\u52A8\u5230\u5E95\u90E8" },
  { value: "CLOSE_TAB", label: "\u5173\u95ED\u6807\u7B7E\u9875" },
  { value: "NEW_TAB", label: "\u65B0\u5EFA\u6807\u7B7E\u9875" },
  { value: "RESTORE_CLOSED_TAB", label: "\u6062\u590D\u5173\u95ED\u6807\u7B7E\u9875" },
  { value: "RELOAD", label: "\u5237\u65B0" },
  { value: "STOP_LOADING", label: "\u505C\u6B62\u52A0\u8F7D" },
  { value: "TAB_LEFT", label: "\u5207\u6362\u5230\u5DE6\u8FB9\u6807\u7B7E\u9875" },
  { value: "TAB_RIGHT", label: "\u5207\u6362\u5230\u53F3\u8FB9\u6807\u7B7E\u9875" },
  { value: "CLOSE_ALL_TABS", label: "\u5173\u95ED\u6240\u6709\u6807\u7B7E\u9875" }
];

const PRESET_CONFIG = {
  sensitive: {
    minSegmentPx: 14,
    minTotalPx: 44,
    maxTimeMs: 1100,
    cardinalToleranceDeg: 22,
    lMinLegPx: 28,
    vMaxAngleDeg: 120,
    vMinLegPx: 40,
    vRelaxed: true,
    showTrail: true,
    debug: false
  },
  balanced: {
    minSegmentPx: 20,
    minTotalPx: 60,
    maxTimeMs: 1500,
    cardinalToleranceDeg: 30,
    lMinLegPx: 35,
    vMaxAngleDeg: 140,
    vMinLegPx: 50,
    vRelaxed: true,
    showTrail: true,
    debug: false
  },
  stable: {
    minSegmentPx: 26,
    minTotalPx: 82,
    maxTimeMs: 1800,
    cardinalToleranceDeg: 18,
    lMinLegPx: 44,
    vMaxAngleDeg: 112,
    vMinLegPx: 66,
    vRelaxed: false,
    showTrail: false,
    debug: false
  }
};

const STATUS_BASE_CLASS = "status-chip";
const STATUS_VARIANT_CLASS = {
  neutral: "status-neutral",
  success: "status-success",
  error: "status-error",
  info: "status-info"
};
const NUMERIC_FIELD_IDS = [
  "minSegmentPx",
  "minTotalPx",
  "maxTimeMs",
  "cardinalToleranceDeg",
  "lMinLegPx",
  "vMaxAngleDeg",
  "vMinLegPx"
];

let statusTimer = null;
let savedConfig = null;
let isDirty = false;

function $(id) {
  return document.getElementById(id);
}

function setStatus(text, type = "neutral") {
  const el = $("status");
  if (statusTimer) clearTimeout(statusTimer);
  if (!text) {
    el.textContent = "";
    el.style.display = "none";
    return;
  }
  el.className = `${STATUS_BASE_CLASS} ${STATUS_VARIANT_CLASS[type] || STATUS_VARIANT_CLASS.neutral}`;
  el.textContent = text;
  el.style.display = "inline-flex";
  statusTimer = setTimeout(() => {
    if (el.textContent === text) {
      el.textContent = "";
      el.style.display = "none";
    }
  }, 1600);
}

function formatBadgeValue(id, value) {
  if (!Number.isFinite(value)) return "--";
  if (id === "maxTimeMs") return `${value}ms`;
  if (id === "cardinalToleranceDeg" || id === "vMaxAngleDeg") return `${value}°`;
  return `${value}px`;
}

function syncBadges() {
  for (const id of NUMERIC_FIELD_IDS) {
    const badge = document.querySelector(`[data-display-for="${id}"]`);
    if (!badge) continue;
    badge.textContent = formatBadgeValue(id, Number($(id).value));
  }
}

function readForm() {
  return {
    minSegmentPx: Number($("minSegmentPx").value),
    minTotalPx: Number($("minTotalPx").value),
    maxTimeMs: Number($("maxTimeMs").value),
    cardinalToleranceDeg: Number($("cardinalToleranceDeg").value),
    lMinLegPx: Number($("lMinLegPx").value),
    vMaxAngleDeg: Number($("vMaxAngleDeg").value),
    vMinLegPx: Number($("vMinLegPx").value),
    vRelaxed: Boolean($("vRelaxed").checked),
    showTrail: Boolean($("showTrail").checked),
    debug: Boolean($("debug").checked)
  };
}

function writeForm(cfg) {
  $("minSegmentPx").value = String(cfg.minSegmentPx);
  $("minTotalPx").value = String(cfg.minTotalPx);
  $("maxTimeMs").value = String(cfg.maxTimeMs);
  $("cardinalToleranceDeg").value = String(cfg.cardinalToleranceDeg);
  $("lMinLegPx").value = String(cfg.lMinLegPx);
  $("vMaxAngleDeg").value = String(cfg.vMaxAngleDeg);
  $("vMinLegPx").value = String(cfg.vMinLegPx);
  $("vRelaxed").checked = Boolean(cfg.vRelaxed);
  $("showTrail").checked = Boolean(cfg.showTrail);
  $("debug").checked = Boolean(cfg.debug);
  syncBadges();
}

function sanitizeNumber(n, fallback, min, max) {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function sanitizeConfig(raw) {
  const cfg = { ...DEFAULT_CONFIG, ...raw };
  cfg.minSegmentPx = sanitizeNumber(cfg.minSegmentPx, DEFAULT_CONFIG.minSegmentPx, 5, 200);
  cfg.minTotalPx = sanitizeNumber(cfg.minTotalPx, DEFAULT_CONFIG.minTotalPx, 10, 400);
  cfg.maxTimeMs = sanitizeNumber(cfg.maxTimeMs, DEFAULT_CONFIG.maxTimeMs, 200, 5000);
  cfg.cardinalToleranceDeg = sanitizeNumber(
    cfg.cardinalToleranceDeg,
    DEFAULT_CONFIG.cardinalToleranceDeg,
    5,
    60
  );
  cfg.lMinLegPx = sanitizeNumber(cfg.lMinLegPx, DEFAULT_CONFIG.lMinLegPx, 10, 400);
  cfg.vMaxAngleDeg = sanitizeNumber(cfg.vMaxAngleDeg, DEFAULT_CONFIG.vMaxAngleDeg, 30, 160);
  cfg.vMinLegPx = sanitizeNumber(cfg.vMinLegPx, DEFAULT_CONFIG.vMinLegPx, 10, 400);
  cfg.vRelaxed = Boolean(cfg.vRelaxed);
  cfg.showTrail = Boolean(cfg.showTrail);
  cfg.debug = Boolean(cfg.debug);
  return cfg;
}

function configToComparable(cfg) {
  return JSON.stringify({
    minSegmentPx: cfg.minSegmentPx,
    minTotalPx: cfg.minTotalPx,
    maxTimeMs: cfg.maxTimeMs,
    cardinalToleranceDeg: cfg.cardinalToleranceDeg,
    lMinLegPx: cfg.lMinLegPx,
    vMaxAngleDeg: cfg.vMaxAngleDeg,
    vMinLegPx: cfg.vMinLegPx,
    vRelaxed: cfg.vRelaxed,
    showTrail: cfg.showTrail,
    debug: cfg.debug
  });
}

function updateDirtyState() {
  if (!savedConfig) return;
  const current = readForm();
  isDirty = configToComparable(current) !== configToComparable(savedConfig);
  const saveBtn = $("save");
  const indicator = $("unsaved-indicator");
  if (isDirty) {
    saveBtn.textContent = "保存设置 *";
    if (indicator) indicator.style.display = "inline-flex";
  } else {
    saveBtn.textContent = "保存设置";
    if (indicator) indicator.style.display = "none";
  }
}

function setButtonsPending(pending) {
  const save = $("save");
  const reset = $("reset");
  save.disabled = pending;
  reset.disabled = pending;
  save.classList.toggle("is-pending", pending);
  reset.classList.toggle("is-pending", pending);
}

function load() {
  chrome.storage.sync.get(DEFAULT_CONFIG, (items) => {
    if (chrome.runtime.lastError) return setStatus("读取失败", "error");
    savedConfig = sanitizeConfig(items);
    writeForm(savedConfig);
    isDirty = false;
    updateDirtyState();
    setStatus("配置已加载", "neutral");
  });
}

function saveConfig() {
  const raw = readForm();
  const saveBtn = $("save");
  setButtonsPending(true);
  saveBtn.textContent = "保存中...";
  chrome.storage.sync.get(DEFAULT_CONFIG, (items) => {
    if (chrome.runtime.lastError) {
      setButtonsPending(false);
      saveBtn.textContent = "保存设置";
      return setStatus("读取失败，无法保存", "error");
    }
    const cfg = sanitizeConfig({ ...items, ...raw });
    chrome.storage.sync.set(cfg, () => {
      setButtonsPending(false);
      if (chrome.runtime.lastError) {
        saveBtn.textContent = "保存失败";
        setStatus("保存失败", "error");
        setTimeout(() => { saveBtn.textContent = "保存设置"; }, 1500);
        return;
      }
      savedConfig = cfg;
      isDirty = false;
      writeForm(cfg);
      updateDirtyState();
      saveBtn.textContent = "已保存 \u2713";
      setStatus("已保存", "success");
      setTimeout(() => {
        if (saveBtn.textContent === "已保存 \u2713") saveBtn.textContent = "保存设置";
      }, 1500);
    });
  });
}

function resetConfig() {
  setButtonsPending(true);
  chrome.storage.sync.set(DEFAULT_CONFIG, () => {
    setButtonsPending(false);
    if (chrome.runtime.lastError) return setStatus("重置失败", "error");
    savedConfig = { ...DEFAULT_CONFIG };
    isDirty = false;
    writeForm(DEFAULT_CONFIG);
    updateDirtyState();
    setStatus("已恢复默认", "success");
  });
}

function applyPreset(name, label) {
  const preset = PRESET_CONFIG[name];
  if (!preset) return;
  const btn = document.querySelector(`[data-preset="${name}"]`);
  if (btn) {
    btn.classList.add("preset-active");
    setTimeout(() => btn.classList.remove("preset-active"), 400);
  }
  const nextConfig = sanitizeConfig({ ...DEFAULT_CONFIG, ...preset });
  writeForm(nextConfig);
  updateDirtyState();
  setStatus(`已应用「${label}」预设，点击保存后生效`, "info");
}

function bindPresetActions() {
  const presetButtons = document.querySelectorAll("[data-preset]");
  for (const button of presetButtons) {
    button.addEventListener("click", () => {
      applyPreset(button.dataset.preset, button.dataset.presetLabel || "预设");
    });
  }
}

function bindLivePreview() {
  for (const id of NUMERIC_FIELD_IDS) {
    $(id).addEventListener("input", () => {
      syncBadges();
      updateDirtyState();
    });
  }
}

function bindChangeDetection() {
  const panel = document.querySelector(".main-panel");
  if (panel) panel.addEventListener("change", updateDirtyState);
}

function bindShortcuts() {
  document.addEventListener("keydown", (event) => {
    const isSave = event.key.toLowerCase() === "s";
    const withCommand = event.ctrlKey || event.metaKey;
    if (isSave && withCommand) {
      event.preventDefault();
      saveConfig();
      return;
    }
    if (event.key === "Escape" && isDirty && savedConfig) {
      writeForm(savedConfig);
      isDirty = false;
      updateDirtyState();
      setStatus("已撤销更改", "info");
    }
  });
}

window.addEventListener("beforeunload", (e) => {
  if (isDirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});

function renderGestureList(map) {
  const list = $("gestureList");
  if (!list) return;
  list.innerHTML = "";
  for (const key of GESTURE_ORDER) {
    const info = GESTURE_LABELS[key];
    if (!info) continue;
    const li = document.createElement("li");
    li.className = "gesture-item";
    const span = document.createElement("span");
    span.textContent = info.label;
    const select = document.createElement("select");
    select.className = "gesture-select";
    select.dataset.gesture = key;
    for (const opt of ACTION_OPTIONS) {
      const o = document.createElement("option");
      o.value = opt.value;
      o.textContent = opt.label;
      select.appendChild(o);
    }
    select.value = map[key] || "NONE";
    select.addEventListener("change", () => saveGestureMap());
    li.appendChild(span);
    li.appendChild(select);
    list.appendChild(li);
  }
}

function readGestureMap() {
  const map = {};
  for (const key of GESTURE_ORDER) {
    const sel = document.querySelector(`select[data-gesture="${key}"]`);
    if (sel) map[key] = sel.value;
  }
  return map;
}

function saveGestureMap() {
  const map = readGestureMap();
  chrome.storage.sync.set({ gestureMap: map }, () => {
    if (chrome.runtime.lastError) {
      setStatus("手势保存失败", "error");
      return;
    }
    setStatus("手势映射已保存", "success");
  });
}

function loadGestureMap() {
  chrome.storage.sync.get({ gestureMap: DEFAULT_GESTURE_MAP }, (items) => {
    if (chrome.runtime.lastError) {
      renderGestureList(DEFAULT_GESTURE_MAP);
      return;
    }
    renderGestureList({ ...DEFAULT_GESTURE_MAP, ...(items.gestureMap || {}) });
  });
}

function resetGestureMap() {
  chrome.storage.sync.set({ gestureMap: DEFAULT_GESTURE_MAP }, () => {
    if (chrome.runtime.lastError) {
      setStatus("重置失败", "error");
      return;
    }
    renderGestureList(DEFAULT_GESTURE_MAP);
    setStatus("手势映射已恢复默认", "success");
  });
}

$("save").addEventListener("click", saveConfig);
$("reset").addEventListener("click", resetConfig);
$("resetGestures").addEventListener("click", resetGestureMap);
bindPresetActions();
bindLivePreview();
bindChangeDetection();
bindShortcuts();
load();
loadGestureMap();
