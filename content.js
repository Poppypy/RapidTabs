(() => {
  const MSG_TYPE = "RAPIDTABS_GESTURE";

  function isContextValid() {
    try {
      return !!chrome.runtime && !!chrome.runtime.id;
    } catch {
      return false;
    }
  }

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

  let config = { ...DEFAULT_CONFIG };
  if (isContextValid()) {
    try {
      chrome.storage.sync.get(DEFAULT_CONFIG, (items) => {
        if (chrome.runtime.lastError) return;
        config = { ...DEFAULT_CONFIG, ...items };
      });
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "sync" || !isContextValid()) return;
        chrome.storage.sync.get(DEFAULT_CONFIG, (items) => {
          if (chrome.runtime.lastError) return;
          config = { ...DEFAULT_CONFIG, ...items };
        });
      });
    } catch {}
  }

  const state = {
    tracking: false,
    suppressContextMenuOnce: false,
    startTime: 0,
    startPoint: null,
    lastPoint: null,
    points: [],
    lastPreview: null,
    previewTs: 0
  };

  function nowMs() {
    return performance.now();
  }

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function pathLength(points) {
    let len = 0;
    for (let i = 1; i < points.length; i++) len += dist(points[i - 1], points[i]);
    return len;
  }

  function angleDeg(dx, dy) {
    const a = (Math.atan2(dy, dx) * 180) / Math.PI;
    return (a + 360) % 360;
  }

  function angleDiffDeg(a, b) {
    let d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
  }

  function quantizeDir8(dx, dy) {
    const a = (angleDeg(dx, dy) + 22.5) % 360;
    const sector = Math.floor(a / 45);
    return ["R", "DR", "D", "DL", "L", "UL", "U", "UR"][sector] || "R";
  }

  function quantizeDir4(dx, dy, toleranceDeg) {
    const a = angleDeg(dx, dy);
    const axes = [
      { dir: "R", deg: 0 },
      { dir: "D", deg: 90 },
      { dir: "L", deg: 180 },
      { dir: "U", deg: 270 }
    ];
    let best = null;
    for (const axis of axes) {
      const diff = angleDiffDeg(a, axis.deg);
      if (diff <= toleranceDeg && (!best || diff < best.diff)) best = { dir: axis.dir, diff };
    }
    return best ? best.dir : null;
  }

  function extractSequences(points) {
    const seq8 = [];
    const seq4 = [];
    let pivot = points[0];
    let last8 = null;
    let last4 = null;

    for (let i = 1; i < points.length; i++) {
      const p = points[i];
      const dx = p.x - pivot.x;
      const dy = p.y - pivot.y;
      if (Math.hypot(dx, dy) < config.minSegmentPx) continue;

      const d8 = quantizeDir8(dx, dy);
      if (d8 !== last8) {
        seq8.push(d8);
        last8 = d8;
      }

      const d4 = quantizeDir4(dx, dy, config.cardinalToleranceDeg);
      if (d4) {
        if (d4 !== last4) {
          seq4.push(d4);
          last4 = d4;
        }
      } else {
        last4 = null;
      }

      pivot = p;
    }

    return { seq8, seq4 };
  }

  function perpDistanceToLine(p, a, b) {
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const wx = p.x - a.x;
    const wy = p.y - a.y;
    const area2 = Math.abs(vx * wy - vy * wx);
    const len = Math.hypot(vx, vy);
    return len < 1 ? 0 : area2 / len;
  }

  function angleBetweenDeg(v1, v2) {
    const dot = v1.x * v2.x + v1.y * v2.y;
    const l1 = Math.hypot(v1.x, v1.y);
    const l2 = Math.hypot(v2.x, v2.y);
    if (l1 < 1 || l2 < 1) return 180;
    const c = Math.max(-1, Math.min(1, dot / (l1 * l2)));
    return (Math.acos(c) * 180) / Math.PI;
  }

  function isDiagonalVector(v) {
    const ax = Math.abs(v.x);
    const ay = Math.abs(v.y);
    if (ax < 1 || ay < 1) return false;
    const r = ax / ay;
    return r >= config.vDiagonalRatioMin && r <= 1 / config.vDiagonalRatioMin;
  }

  function findVertexByMaxDistance(points) {
    if (points.length < 3) return null;
    const start = points[0];
    const end = points[points.length - 1];
    let bestIdx = -1;
    let bestDist = 0;
    for (let i = 1; i < points.length - 1; i++) {
      const d = perpDistanceToLine(points[i], start, end);
      if (d > bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    if (bestIdx < 0) return null;
    return { start, end, vertex: points[bestIdx], bestIdx, bestDist };
  }

  const ACTION_NAMES = {
    NONE: "无操作",
    BACK: "后退",
    FORWARD: "前进",
    SCROLL_UP: "向上滚动",
    SCROLL_DOWN: "向下滚动",
    SCROLL_TOP: "滚动到顶部",
    SCROLL_BOTTOM: "滚动到底部",
    CLOSE_TAB: "关闭标签页",
    NEW_TAB: "新建标签页",
    RESTORE_CLOSED_TAB: "恢复关闭标签页",
    RELOAD: "刷新",
    STOP_LOADING: "停止加载",
    TAB_LEFT: "切换到左边标签页",
    TAB_RIGHT: "切换到右边标签页",
    CLOSE_ALL_TABS: "关闭所有标签页"
  };

  const ACTION_ICONS = {
    CLOSE_TAB: "\u2715",
    CLOSE_ALL_TABS: "\u2715\u2715",
    NEW_TAB: "+",
    RESTORE_CLOSED_TAB: "\u21A9",
    BACK: "\u2190",
    FORWARD: "\u2192",
    SCROLL_TOP: "\u2191\u2191",
    SCROLL_BOTTOM: "\u2193\u2193",
    SCROLL_UP: "\u2191",
    SCROLL_DOWN: "\u2193",
    STOP_LOADING: "\u25A0",
    RELOAD: "\u21BB",
    TAB_LEFT: "\u25C0",
    TAB_RIGHT: "\u25B6"
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

  let gestureMap = { ...DEFAULT_GESTURE_MAP };
  if (isContextValid()) {
    try {
      chrome.storage.sync.get({ gestureMap: DEFAULT_GESTURE_MAP }, (items) => {
        if (!chrome.runtime.lastError && items.gestureMap) {
          gestureMap = { ...DEFAULT_GESTURE_MAP, ...items.gestureMap };
        }
      });
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "sync" || !isContextValid()) return;
        if (changes.gestureMap) {
          gestureMap = { ...DEFAULT_GESTURE_MAP, ...(changes.gestureMap.newValue || {}) };
        }
      });
    } catch {}
  }

  function detectL(points) {
    const corner = findVertexByMaxDistance(points);
    if (!corner) return null;
    if (corner.bestDist < config.minSegmentPx) return null;

    const v1 = { x: corner.vertex.x - corner.start.x, y: corner.vertex.y - corner.start.y };
    const v2 = { x: corner.end.x - corner.vertex.x, y: corner.end.y - corner.vertex.y };
    const len1 = Math.hypot(v1.x, v1.y);
    const len2 = Math.hypot(v2.x, v2.y);
    if (len1 < config.lMinLegPx || len2 < config.lMinLegPx) return null;

    const d1 = quantizeDir4(v1.x, v1.y, config.cardinalToleranceDeg);
    const d2 = quantizeDir4(v2.x, v2.y, config.cardinalToleranceDeg);
    if (!d1 || !d2 || d1 === d2) return null;

    const key = `${d1}${d2}`;
    const action = gestureMap[key];
    if (!action || action === "NONE") return null;
    return { name: ACTION_NAMES[action] || action, action };
  }

  function detectV(points) {
    const corner = findVertexByMaxDistance(points);
    if (!corner) return null;
    if (corner.bestDist < config.minSegmentPx) return null;

    const leg1 = { x: corner.start.x - corner.vertex.x, y: corner.start.y - corner.vertex.y };
    const leg2 = { x: corner.end.x - corner.vertex.x, y: corner.end.y - corner.vertex.y };
    const len1 = Math.hypot(leg1.x, leg1.y);
    const len2 = Math.hypot(leg2.x, leg2.y);
    if (len1 < config.vMinLegPx || len2 < config.vMinLegPx) return null;

    if (!isDiagonalVector(leg1) || !isDiagonalVector(leg2)) return null;

    if (Math.sign(leg1.x) === 0 || Math.sign(leg2.x) === 0) return null;
    if (Math.sign(leg1.x) === Math.sign(leg2.x)) return null;

    const angle = angleBetweenDeg(leg1, leg2);
    if (angle > config.vMaxAngleDeg) return null;

    const margin = config.vVertexMarginPx;
    if (corner.vertex.y > Math.max(corner.start.y, corner.end.y) + margin) return "V";
    if (corner.vertex.y < Math.min(corner.start.y, corner.end.y) - margin) return "INV_V";
    return null;
  }

  function detectVRelaxed(points) {
    if (points.length < 3) return null;
    const start = points[0];
    const end = points[points.length - 1];
    const margin = config.vVertexMarginPx;

    let idxMinY = -1;
    let idxMaxY = -1;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 1; i < points.length - 1; i++) {
      const y = points[i].y;
      if (y < minY) {
        minY = y;
        idxMinY = i;
      }
      if (y > maxY) {
        maxY = y;
        idxMaxY = i;
      }
    }

    const tryVertex = (idx) => {
      if (idx <= 0 || idx >= points.length - 1) return null;
      const vtx = points[idx];
      const dx1 = vtx.x - start.x;
      const dy1 = vtx.y - start.y;
      const dx2 = end.x - vtx.x;
      const dy2 = end.y - vtx.y;
      const len1 = Math.hypot(dx1, dy1);
      const len2 = Math.hypot(dx2, dy2);
      if (len1 < config.vMinLegPx || len2 < config.vMinLegPx) return null;
      const d1 = quantizeDir4(dx1, dy1, config.cardinalToleranceDeg);
      const d2 = quantizeDir4(dx2, dy2, config.cardinalToleranceDeg);
      if (!d1 || !d2) return null;
      if (d1 === "U" && d2 === "D" && vtx.y < Math.min(start.y, end.y) - margin) return "INV_V";
      if (d1 === "D" && d2 === "U" && vtx.y > Math.max(start.y, end.y) + margin) return "V";
      return null;
    };

    return tryVertex(idxMinY) || tryVertex(idxMaxY);
  }

  function detectSwipe(points) {
    if (points.length < 2) return null;
    const start = points[0];
    const end = points[points.length - 1];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const corner = findVertexByMaxDistance(points);
    const dominant = Math.max(absDx, absDy);
    if (dominant < config.minTotalPx) return null;
    if (corner && corner.bestDist > dominant * 0.3) return null;
    let key;
    if (absDx >= absDy) {
      if (absDy > absDx * 0.5) return null;
      key = dx < 0 ? "L" : "R";
    } else {
      if (absDx > absDy * 0.5) return null;
      key = dy < 0 ? "U" : "D";
    }
    const action = gestureMap[key];
    if (!action || action === "NONE") return null;
    return { name: ACTION_NAMES[action] || action, action };
  }

  function recognize(points) {
    if (points.length < 2) return null;

    const duration = points[points.length - 1].t - points[0].t;
    if (duration > config.maxTimeMs) return null;

    const travel = pathLength(points);
    if (travel < config.minTotalPx) return null;

    const { seq8, seq4 } = extractSequences(points);
    if (config.debug) {
      console.debug("[RapidTabs] travel=", Math.round(travel), "seq4=", seq4.join(""), "seq8=", seq8.join("-"));
    }

    const l = detectL(points);
    if (l) return l;

    const swipe = detectSwipe(points);
    if (swipe) return swipe;

    return null;
  }

  function scrollTargetForPoint(pt) {
    let el = null;
    if (pt && typeof pt.x === "number" && typeof pt.y === "number") {
      try {
        el = document.elementFromPoint(pt.x, pt.y);
      } catch {}
    }

    for (let n = el; n && n instanceof HTMLElement; n = n.parentElement) {
      if (n === document.body || n === document.documentElement) break;
      const style = window.getComputedStyle(n);
      const oy = style.overflowY;
      const canScrollY =
        (oy === "auto" || oy === "scroll" || oy === "overlay") && n.scrollHeight - n.clientHeight > 8;
      if (canScrollY) return n;
    }

    return document.scrollingElement || document.documentElement;
  }

  function scrollToTop(pt) {
    const target = scrollTargetForPoint(pt);
    if (target === document.scrollingElement || target === document.documentElement || target === document.body) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    target.scrollTo({ top: 0, behavior: "smooth" });
  }

  function scrollToBottom(pt) {
    const target = scrollTargetForPoint(pt);
    const top = Math.max(0, target.scrollHeight - target.clientHeight);
    if (target === document.scrollingElement || target === document.documentElement || target === document.body) {
      window.scrollTo({ top, behavior: "smooth" });
      return;
    }
    target.scrollTo({ top, behavior: "smooth" });
  }

  function showOverlayText(text, ms) {
    if (!config.showTrail) return;
    if (!trail.root || !trail.label) return;
    trail.root.style.display = "block";
    trail.root.style.opacity = "1";
    trail.label.textContent = String(text || "");
    trail.label.style.display = "block";
    requestAnimationFrame(() => {
      trail.label.style.opacity = "1";
      trail.label.style.transform = "translateX(-50%) translateY(0)";
    });
    trailHide(typeof ms === "number" ? ms : 1200);
  }

  function sendTabAction(action) {
    if (!isContextValid()) return;
    try {
      chrome.runtime.sendMessage({ type: MSG_TYPE, action }, (resp) => {
        const err = chrome.runtime.lastError ? chrome.runtime.lastError.message : "";
        const respErr = resp && resp.ok === false && resp.error ? String(resp.error) : "";
        if (config.debug) console.debug("[RapidTabs] bg=", action, "resp=", resp, "err=", err);
        if (err || respErr) showOverlayText(`ERR: ${err || respErr}`, 1600);
      });
    } catch {}
  }

  function scrollUp(pt) {
    const target = scrollTargetForPoint(pt);
    const amount = Math.max(200, Math.round(window.innerHeight * 0.75));
    target.scrollBy({ top: -amount, behavior: "smooth" });
  }

  function scrollDown(pt) {
    const target = scrollTargetForPoint(pt);
    const amount = Math.max(200, Math.round(window.innerHeight * 0.75));
    target.scrollBy({ top: amount, behavior: "smooth" });
  }

  function perform(action, ctx) {
    const pt = (ctx && ctx.anchorPoint) || (ctx && ctx.endPoint) || null;
    switch (action) {
      case "SCROLL_TOP":
        scrollToTop(pt);
        return;
      case "SCROLL_BOTTOM":
        scrollToBottom(pt);
        return;
      case "SCROLL_UP":
        scrollUp(pt);
        return;
      case "SCROLL_DOWN":
        scrollDown(pt);
        return;
      case "STOP_LOADING":
        try {
          window.stop();
        } catch {}
        showOverlayText("停止加载", 700);
        return;
      case "RELOAD":
        location.reload();
        return;
      case "BACK":
        history.back();
        return;
      case "FORWARD":
        history.forward();
        return;
      default:
        sendTabAction(action);
        return;
    }
  }

  const trail = {
    root: null,
    canvas: null,
    label: null,
    ctx: null,
    dpr: 1,
    last: null,
    hideTimer: 0,
    labelHideTimer: 0
  };

  function ensureTrail() {
    if (trail.root) return;
    const root = document.createElement("div");
    root.style.position = "fixed";
    root.style.left = "0";
    root.style.top = "0";
    root.style.width = "100vw";
    root.style.height = "100vh";
    root.style.pointerEvents = "none";
    root.style.zIndex = "2147483647";
    root.style.display = "none";
    root.style.opacity = "0";
    root.style.transition = "opacity 0.2s ease-out";

    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";

    const label = document.createElement("div");
    label.style.position = "absolute";
    label.style.left = "50%";
    label.style.top = "14px";
    label.style.transform = "translateX(-50%) translateY(-8px)";
    label.style.padding = "8px 16px";
    label.style.borderRadius = "12px";
    label.style.background = "rgba(15, 23, 42, 0.82)";
    label.style.backdropFilter = "blur(8px)";
    label.style.webkitBackdropFilter = "blur(8px)";
    label.style.color = "#fff";
    label.style.font = "14px/1.3 system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    label.style.fontWeight = "600";
    label.style.letterSpacing = "0.02em";
    label.style.boxShadow = "0 4px 14px rgba(0, 0, 0, 0.18)";
    label.style.display = "none";
    label.style.opacity = "0";
    label.style.whiteSpace = "nowrap";
    label.style.transition = "opacity 0.18s ease, transform 0.18s ease";

    root.appendChild(canvas);
    root.appendChild(label);
    (document.documentElement || document.body).appendChild(root);

    trail.root = root;
    trail.canvas = canvas;
    trail.label = label;
    trail.ctx = canvas.getContext("2d");

    const resize = () => {
      if (!trail.canvas || !trail.ctx) return;
      trail.dpr = Math.max(1, window.devicePixelRatio || 1);
      const w = Math.max(1, window.innerWidth);
      const h = Math.max(1, window.innerHeight);
      trail.canvas.width = Math.floor(w * trail.dpr);
      trail.canvas.height = Math.floor(h * trail.dpr);
      trail.ctx.setTransform(trail.dpr, 0, 0, trail.dpr, 0, 0);
      trail.ctx.lineJoin = "round";
      trail.ctx.lineCap = "round";
    };
    resize();
    window.addEventListener("resize", resize, true);
  }

  function trailShow(startPoint) {
    if (!config.showTrail) return;
    ensureTrail();
    if (!trail.root || !trail.ctx) return;
    clearTimeout(trail.hideTimer);
    clearTimeout(trail.labelHideTimer);
    trail.hideTimer = 0;
    trail.labelHideTimer = 0;
    trail.root.style.display = "block";
    requestAnimationFrame(() => {
      trail.root.style.opacity = "1";
    });
    if (trail.label) {
      trail.label.textContent = "";
      trail.label.style.display = "none";
      trail.label.style.opacity = "0";
      trail.label.style.transform = "translateX(-50%) translateY(-8px)";
    }
    trail.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    trail.ctx.shadowColor = "rgba(59, 130, 246, 0.35)";
    trail.ctx.shadowBlur = 8;
    trail.ctx.strokeStyle = "rgba(59, 130, 246, 0.85)";
    trail.ctx.lineWidth = 3.5;
    trail.last = { x: startPoint.x, y: startPoint.y };
  }

  function trailMove(p) {
    if (!config.showTrail) return;
    if (!trail.ctx || !trail.last) return;
    trail.ctx.beginPath();
    trail.ctx.moveTo(trail.last.x, trail.last.y);
    trail.ctx.lineTo(p.x, p.y);
    trail.ctx.stroke();
    trail.last = { x: p.x, y: p.y };
  }

  function trailHide(delayMs) {
    if (!trail.root) return;
    trail.last = null;
    clearTimeout(trail.hideTimer);
    const fadeDelay = Math.max(0, delayMs || 0);
    trail.hideTimer = setTimeout(() => {
      trail.root.style.opacity = "0";
      setTimeout(() => {
        if (trail.root) trail.root.style.display = "none";
      }, 220);
    }, fadeDelay);
  }

  function updatePreview() {
    if (!config.showTrail || !trail.label) return;
    if (state.points.length < 3) return;
    const now = nowMs();
    if (now - state.previewTs < 80) return;
    state.previewTs = now;
    const result = recognize(state.points);
    const key = result ? result.action : null;
    if (key === state.lastPreview) return;
    state.lastPreview = key;
    if (result) {
      const icon = ACTION_ICONS[result.action] || "";
      trail.label.textContent = icon ? `${icon}  ${result.name}` : result.name;
      trail.label.style.display = "block";
      trail.label.style.opacity = "0.55";
      trail.label.style.transform = "translateX(-50%) translateY(0)";
    } else {
      trail.label.style.opacity = "0";
    }
  }

  function startTracking(e) {
    state.tracking = true;
    state.suppressContextMenuOnce = false;
    state.startTime = nowMs();
    state.startPoint = { x: e.clientX, y: e.clientY, t: state.startTime };
    state.lastPoint = state.startPoint;
    state.points = [state.startPoint];
    state.lastPreview = null;
    state.previewTs = 0;
    trailShow(state.startPoint);
  }

  function stopTracking(e) {
    if (!state.tracking) return;
    state.tracking = false;
    const anchorPoint = state.startPoint ? { x: state.startPoint.x, y: state.startPoint.y } : null;
    const end = { x: e.clientX, y: e.clientY, t: nowMs() };
    if (state.points.length < config.maxPoints) state.points.push(end);
    trailMove(end);

    const result = recognize(state.points);
    state.points = [];
    state.startPoint = null;
    state.lastPoint = null;
    if (result && trail.label) {
      const icon = ACTION_ICONS[result.action] || "";
      trail.label.textContent = icon ? `${icon}  ${result.name}` : result.name;
      trail.label.style.display = "block";
      trail.label.style.opacity = "1";
      trail.label.style.transform = "translateX(-50%) translateY(0)";
    }
    trailHide(result ? 700 : 0);

    if (!result) return;

    state.suppressContextMenuOnce = true;
    if (config.debug) console.debug("[RapidTabs] gesture=", result.name, "action=", result.action);
    perform(result.action, { anchorPoint, endPoint: { x: end.x, y: end.y } });
  }

  function cancelTracking() {
    state.tracking = false;
    state.points = [];
    state.startPoint = null;
    state.lastPoint = null;
    state.suppressContextMenuOnce = false;
    state.lastPreview = null;
    trailHide(0);
  }

  document.addEventListener(
    "mousedown",
    (e) => {
      if (e.button !== 2) return;
      startTracking(e);
    },
    true
  );

  document.addEventListener(
    "mousemove",
    (e) => {
      if (!state.tracking) return;
      if ((e.buttons & 2) === 0) return cancelTracking();

      const p = { x: e.clientX, y: e.clientY, t: nowMs() };
      if (dist(p, state.lastPoint) < config.sampleMinPx) return;
      state.lastPoint = p;
      if (state.points.length < config.maxPoints) state.points.push(p);
      trailMove(p);
      updatePreview();
    },
    { capture: true, passive: true }
  );

  document.addEventListener(
    "mouseup",
    (e) => {
      if (e.button !== 2) return;
      stopTracking(e);
    },
    true
  );

  document.addEventListener(
    "contextmenu",
    (e) => {
      if (!state.suppressContextMenuOnce) return;
      state.suppressContextMenuOnce = false;
      e.preventDefault();
      e.stopPropagation();
    },
    true
  );

  window.addEventListener("blur", cancelTracking, true);
})();
