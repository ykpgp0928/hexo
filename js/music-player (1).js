/**
 * =============================================================================
 * Custom Floating Music Player — Hexo Butterfly (Mobile Upgraded)
 * =============================================================================
 */
(function () {
  "use strict";

  const CONFIG = {
    server: "netease",
    type: "playlist",
    id: "3778678",
    apis: [
      "https://api.injahow.cn/meting/?server=:server&type=:type&id=:id",
      "https://meting.mikus.ink/api?server=:server&type=:type&id=:id",
      "https://api.i-meto.com/meting/api?server=:server&type=:type&id=:id&r=:r"
    ],
    storageKey: "mp-state-v3",
    snapThreshold: 40,
    snapRelease: 36,
    snapThresholdMobile: 28,
    snapReleaseMobile: 28,
    longPressMs: 380,
    clickThreshold: 12,
    ballSize: 66,
    ballSizeMobile: 52
  };

  let magnetSide = null;

  let audio = null;
  let playlist = [];
  let currentIndex = 0;
  let isPlaying = false;
  let volume = 0.7;
  let loopMode = "all";
  let orderMode = "list";
  let isOpen = false;
  let isListOpen = false;
  let isDockListOpen = false;
  let isMobile = false;
  let ignoreBallToggleUntil = 0; // 关闭 Dock 后短时间内禁止再次 toggle
  let dockAnchorX = null; // 吸附时锁定的坐标，防止被大卡片 clamp 改写
  let dockAnchorY = null;
  let lastDockSide = null;
  let ballGestureId = null;      // 当前 pointer 手势 id，每手势只 toggle 一次
  let ballToggleBusy = false;    // setOpen 重入锁
  let lastToggleAt = 0; // 防止移动端同一次点击关闭后又立刻打开
  let posX = 0;
  let posY = 0;

  let dragging = false;
  let wasDragging = false;
  let longPressTriggered = false;
  let startClientX = 0;
  let startClientY = 0;
  let originX = 0;
  let originY = 0;
  let moveDist = 0;
  let longPressTimer = null;
  let activePointer = null;
  let pointerId = null;

  let root = null;
  let coverEl = null;
  let titleEl = null;
  let artistEl = null;
  let playedEl = null;
  let timeEl = null;
  let listInner = null;
  let playBtnIcon = null;
  let dockPlayBtnIcon = null; // 新增：用于存放 Dock 模式下的播放图标

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function isTouchDevice() { return "ontouchstart" in window || navigator.maxTouchPoints > 0; }
  function formatTime(sec) {
    if (!isFinite(sec) || sec < 0) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
  }
  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
  function getState() { try { return JSON.parse(localStorage.getItem(CONFIG.storageKey)) || {}; } catch (e) { return {}; } }
  function saveState(partial) { try { const old = getState(); localStorage.setItem(CONFIG.storageKey, JSON.stringify(Object.assign({}, old, partial))); } catch (e) {} }

  function loadPersisted() {
    const s = getState();
    if (s.position && typeof s.position.x === "number" && typeof s.position.y === "number") {
      posX = s.position.x; posY = s.position.y;
    }
    if (s.volume != null) volume = clamp(s.volume, 0, 1);
    if (s.loopMode) loopMode = s.loopMode;
    if (s.orderMode) orderMode = s.orderMode;
    if (s.index != null) currentIndex = s.index;
  }

  function persistNow() {
    saveState({ position: { x: posX, y: posY }, volume, loopMode, orderMode, index: currentIndex, time: audio ? audio.currentTime : 0 });
  }



  function applyTransform() {
    if (!root) return;
    root.style.transform = "translate(" + posX + "px," + posY + "px)";
  }

  // 修改1：新增宽高重写参数，预判移动端展开卡片时的边界，防止撑出版心
  function clampPosition(x, y, overrideW, overrideH) {
    if (!root) return [x, y];
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = overrideW !== undefined ? overrideW : (root.offsetWidth || 66);
    const h = overrideH !== undefined ? overrideH : (root.offsetHeight || 66);
    const style = getComputedStyle(root);
    const leftBase = parseFloat(style.left) || 20;
    const bottomBase = parseFloat(style.bottom) || 20;
    const margin = 8;

    const minX = margin - leftBase;
    const maxX = vw - leftBase - w - margin;
    const minY = margin - vh + bottomBase + h;
    const maxY = bottomBase - margin;

    return [clamp(x, minX, maxX), clamp(y, minY, maxY)];
  }

  function getBallSize() { return window.innerWidth <= 600 ? CONFIG.ballSizeMobile : CONFIG.ballSize; }
  function getSnapTargets() {
    const vw = window.innerWidth;
    const leftBase = parseFloat(getComputedStyle(root).left) || 20;
    const w = getBallSize();
    const edgePad = window.innerWidth <= 600 ? 12 : 16;
    return { leftBase, w, leftX: edgePad - leftBase, rightX: vw - w - edgePad - leftBase, vw };
  }

  function getSnapDistances() {
    const mobile = window.innerWidth <= 600 || isTouchDevice();
    return { enter: mobile ? CONFIG.snapThresholdMobile : CONFIG.snapThreshold, leave: mobile ? CONFIG.snapReleaseMobile : CONFIG.snapRelease };
  }

  function applyMagneticX(freeX, clientX) {
    if (!root) return freeX;
    const { leftBase, w, leftX, rightX, vw } = getSnapTargets();
    const { enter, leave } = getSnapDistances();
    const absLeft = leftBase + freeX;
    const absRight = absLeft + w;

    if (magnetSide === "left") {
      let tentative = originX + (clientX - startClientX);
      if (tentative < leftX) { originX = leftX - (clientX - startClientX); return leftX; }
      if (tentative - leftX >= leave) { magnetSide = null; if (root) root.classList.remove("is-magnet", "magnet-left", "magnet-right"); return tentative; }
      return leftX;
    }
    if (magnetSide === "right") {
      let tentative = originX + (clientX - startClientX);
      if (tentative > rightX) { originX = rightX - (clientX - startClientX); return rightX; }
      if (rightX - tentative >= leave) { magnetSide = null; if (root) root.classList.remove("is-magnet", "magnet-left", "magnet-right"); return tentative; }
      return rightX;
    }
    if (absLeft < enter) {
      magnetSide = "left"; originX = leftX - (clientX - startClientX);
      if (root) { root.classList.add("is-magnet", "magnet-left"); root.classList.remove("magnet-right"); }
      return leftX;
    }
    if (absRight > vw - enter) {
      magnetSide = "right"; originX = rightX - (clientX - startClientX);
      if (root) { root.classList.add("is-magnet", "magnet-right"); root.classList.remove("magnet-left"); }
      return rightX;
    }
    return freeX;
  }

  function setDocked(side) {
    if (!root) return;
    if (side === "left" || side === "right") {
      root.classList.add("is-docked");
      root.classList.toggle("dock-left", side === "left");
      root.classList.toggle("dock-right", side === "right");
      root.classList.remove("expand-left");
      lastDockSide = side;
      lockDockAnchor(side);
      syncDockLoopBtn();
      if (typeof updateDockDirection === "function") updateDockDirection();
    } else {
      root.classList.remove("is-docked", "dock-left", "dock-right", "dock-list-open", "dock-down", "is-dock-closing");
      closeDockList();
      if (!dragging) {
        dockAnchorX = null;
        dockAnchorY = null;
        lastDockSide = null;
      }
    }
  }


  function syncDockFromPosition() {
    if (!root || dragging) return;
    const { leftBase, w, leftX, rightX, vw } = getSnapTargets();
    const { enter } = getSnapDistances();
    const absLeft = leftBase + posX;
    const absRight = absLeft + w;
    const threshold = enter + 8;
    if (absLeft < threshold || Math.abs(posX - leftX) < 4) setDocked("left");
    else if (absRight > vw - threshold || Math.abs(posX - rightX) < 4) setDocked("right");
    else setDocked(null);
  }

  function snapToEdge() {
    if (!root) return;
    const { leftBase, w, leftX, rightX, vw } = getSnapTargets();
    const { enter } = getSnapDistances();
    const absLeft = leftBase + posX;
    const absRight = absLeft + w;
    let targetX = posX;
    let finalSide = null;

    if (magnetSide === "left" || absLeft < enter) { targetX = leftX; finalSide = "left"; }
    else if (magnetSide === "right" || absRight > vw - enter) { targetX = rightX; finalSide = "right"; }

    const [cx, cy] = clampPosition(targetX, posY);
    const moved = Math.abs(cx - posX) > 0.5 || Math.abs(cy - posY) > 0.5;
    posX = cx; posY = cy;
    magnetSide = null;
    if (root) root.classList.remove("is-magnet", "magnet-left", "magnet-right", "magnet-breaking");

    if (moved) {
      root.classList.add("is-snapping");
      applyTransform();
      setTimeout(() => { if (root) root.classList.remove("is-snapping"); }, 400);
    } else {
      applyTransform();
    }
    setDocked(finalSide);
    updateExpandDirection();
    persistNow();
  }

  function updateExpandDirection() {
    if (!root || root.classList.contains("is-docked") || dragging) {
      if (root) root.classList.remove("expand-left");
      return;
    }
    if (isMobile && isOpen) return;

    const { leftBase, vw } = getSnapTargets();
    const absLeft = leftBase + posX;
    let openW = 360;
    try {
      const raw = getComputedStyle(root).getPropertyValue("--mp-width-open").trim();
      if (raw) {
        const d = document.createElement("div");
        d.style.cssText = "position:absolute;visibility:hidden;width:" + raw;
        document.body.appendChild(d);
        openW = d.offsetWidth || openW;
        d.remove();
      }
    } catch (e) {}
    if (absLeft + openW > vw - 12) root.classList.add("expand-left");
    else root.classList.remove("expand-left");
  }

  function buildApiUrl(template) { return template.replace(":server", CONFIG.server).replace(":type", CONFIG.type).replace(":id", CONFIG.id).replace(":r", String(Math.random())); }

  async function fetchPlaylist() {
    let lastErr = null;
    for (const api of CONFIG.apis) {
      try {
        const res = await fetch(buildApiUrl(api), { mode: "cors" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return data.map((item, i) => ({ name: item.name || item.title || "Unknown", artist: item.artist || item.author || "Unknown", url: item.url, pic: item.pic || item.cover || "", lrc: item.lrc || "", index: i }));
        }
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error("All Meting APIs failed");
  }

  function createPlayerDOM() {
    let el = document.getElementById("music-player");
    if (el) { if (!document.body.contains(el)) document.body.appendChild(el); return el; }
    el = document.createElement("div");
    el.id = "music-player";
    if (window.innerWidth <= 600) el.classList.add("is-mobile");
    el.style.cssText = "position:fixed;left:20px;bottom:20px;z-index:99999;display:block;visibility:visible;opacity:1;pointer-events:auto;box-sizing:border-box";
    el.innerHTML = `
      <div class="mp-main">
        <div class="mp-cover" id="mp-cover"><div class="mp-cover-play"><i class="fas fa-play"></i></div></div>
        <div class="mp-body">
          <div class="mp-meta">
            <div class="mp-title" id="mp-title">加载中...</div>
            <div class="mp-artist" id="mp-artist">—</div>
          </div>
          <div class="mp-controller">
            <div class="mp-progress-wrap" id="mp-progress"><div class="mp-progress-bar"><div class="mp-progress-played" id="mp-played"></div></div></div>
            <div class="mp-time" id="mp-time">0:00 / 0:00</div>
            <div class="mp-btns">
              <button class="mp-btn" id="mp-loop" type="button" title="循环"><i class="fas fa-repeat"></i></button>
              <button class="mp-btn" id="mp-prev" type="button" title="上一首"><i class="fas fa-step-backward"></i></button>
              <button class="mp-btn" id="mp-play" type="button" title="播放/暂停"><i class="fas fa-play"></i></button>
              <button class="mp-btn" id="mp-next" type="button" title="下一首"><i class="fas fa-step-forward"></i></button>
              <button class="mp-btn" id="mp-list-btn" type="button" title="歌单"><i class="fas fa-list"></i></button>
            </div>
          </div>
        </div>
      </div>
      <div class="mp-dock-btns" id="mp-dock-btns" aria-hidden="true">
        <button class="mp-dock-btn" id="mp-dock-play" type="button" title="播放/暂停"><i class="fas fa-play"></i></button>
        <button class="mp-dock-btn" id="mp-dock-prev" type="button" title="上一首"><i class="fas fa-step-backward"></i></button>
        <button class="mp-dock-btn" id="mp-dock-next" type="button" title="下一首"><i class="fas fa-step-forward"></i></button>
        <button class="mp-dock-btn" id="mp-dock-loop" type="button" title="循环"><i class="fas fa-repeat"></i></button>
        <button class="mp-dock-btn" id="mp-dock-list-btn" type="button" title="歌单"><i class="fas fa-list"></i></button>
      </div>
      <div class="mp-list" id="mp-list"><div class="mp-list-inner" id="mp-list-inner"><div class="mp-loading"><i class="fas fa-spinner"></i> 加载歌单...</div></div></div>
    `;
    document.body.appendChild(el);
    return el;
  }

  function ensureDockListPanel() {
    let panel = document.getElementById("mp-dock-list");
    if (panel) { if (panel.parentElement && panel.parentElement.id === "music-player") document.body.appendChild(panel); return panel; }
    panel = document.createElement("div");
    panel.className = "mp-dock-list";
    panel.id = "mp-dock-list";
    panel.setAttribute("aria-hidden", "true");
    panel.innerHTML = '<div class="mp-dock-list-inner" id="mp-dock-list-inner"><div class="mp-loading"><i class="fas fa-spinner"></i> 加载歌单...</div></div>';
    document.body.appendChild(panel);
    return panel;
  }

  function updateCover(url) { if (coverEl) coverEl.style.backgroundImage = url ? `url("${url}")` : ""; }

  function updateMeta() {
    if (!playlist.length) return;
    const song = playlist[currentIndex];
    if (titleEl) titleEl.textContent = song.name;
    if (artistEl) artistEl.textContent = song.artist;
    updateCover(song.pic);
    const highlight = (container, shouldScroll) => {
      if (!container) return;
      container.querySelectorAll(".mp-list-item").forEach((item, i) => item.classList.toggle("active", i === currentIndex));
      const active = container.querySelector(".mp-list-item.active");
      if (active && shouldScroll) active.scrollIntoView({ block: "nearest", behavior: "smooth" });
    };
    highlight(listInner, isListOpen);
    highlight($("#mp-dock-list-inner"), isDockListOpen);
  }

  function updatePlayIcon() {
    const iconClass = isPlaying ? "fas fa-pause" : "fas fa-play";
    if (playBtnIcon) playBtnIcon.className = iconClass;
    if (dockPlayBtnIcon) dockPlayBtnIcon.className = iconClass; // 新增：同步更改 Dock 中的图标
    if (root) root.classList.toggle("is-playing", isPlaying);
  }
  function updateProgress() {
    if (!audio || !playedEl || !timeEl) return;
    const cur = audio.currentTime || 0, dur = audio.duration || 0;
    playedEl.style.width = (dur > 0 ? (cur / dur) * 100 : 0) + "%";
    timeEl.textContent = formatTime(cur) + " / " + formatTime(dur);
  }

  function renderList() {
    const html = !playlist.length ? '<div class="mp-empty">歌单为空</div>' : playlist.map((s, i) => `
      <div class="mp-list-item${i === currentIndex ? " active" : ""}" data-index="${i}">
        <span class="mp-list-index">${i + 1}</span>
        <div class="mp-list-info">
          <div class="mp-list-name">${escapeHtml(s.name)}</div><div class="mp-list-artist">${escapeHtml(s.artist)}</div>
        </div>
      </div>`).join("");
    if (listInner) listInner.innerHTML = html;
    const dockInner = $("#mp-dock-list-inner");
    if (dockInner) dockInner.innerHTML = html;
  }

  function escapeHtml(str) { return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

  function ensureAudio() {
    if (audio) return audio;
    audio = new Audio(); audio.preload = "metadata"; audio.volume = volume;
    audio.addEventListener("timeupdate", updateProgress);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", () => { isPlaying = true; updatePlayIcon(); persistNow(); });
    audio.addEventListener("pause", () => { isPlaying = false; updatePlayIcon(); persistNow(); });
    audio.addEventListener("error", () => setTimeout(() => playNext(true), 800));
    return audio;
  }

  function loadSong(index, autoPlay) {
    if (!playlist.length) return;
    currentIndex = ((index % playlist.length) + playlist.length) % playlist.length;
    ensureAudio();
    audio.src = playlist[currentIndex].url; audio.load();
    updateMeta(); persistNow();
    if (autoPlay) { const p = audio.play(); if (p && p.catch) p.catch(() => {}); }
  }

  function togglePlay() {
    ensureAudio();
    if (!audio.src && playlist.length) return loadSong(currentIndex, true);
    if (audio.paused) { const p = audio.play(); if (p && p.catch) p.catch(() => {}); } else audio.pause();
  }

  function playNext(force) {
    if (!playlist.length) return;
    let next = orderMode === "random" ? Math.floor(Math.random() * playlist.length) : currentIndex + 1;
    if (next >= playlist.length) { if (loopMode === "all" || force) next = 0; else return; }
    loadSong(next, true);
  }

  function playPrev() {
    if (!playlist.length) return;
    loadSong(currentIndex - 1 < 0 ? playlist.length - 1 : currentIndex - 1, true);
  }

  function onEnded() { if (loopMode === "one") { audio.currentTime = 0; audio.play().catch(() => {}); } else playNext(false); }

  function seek(ratio) { if (audio && isFinite(audio.duration)) { audio.currentTime = clamp(ratio, 0, 1) * audio.duration; updateProgress(); } }

  function syncDockLoopBtn() {
    const btn = $("#mp-dock-loop");
    if (!btn) return;
    btn.classList.toggle("active", loopMode !== "none");
    btn.title = loopMode === "all" ? "列表循环" : loopMode === "one" ? "单曲循环" : "不循环";
    const icon = btn.querySelector("i");
    if (icon) icon.className = loopMode === "one" ? "fas fa-redo" : "fas fa-repeat";
  }

  function toggleLoop() {
    const modes = ["all", "one", "none"];
    loopMode = modes[(modes.indexOf(loopMode) + 1) % modes.length];
    const btn = $("#mp-loop");
    if (btn) {
      btn.classList.toggle("active", loopMode !== "none");
      btn.title = loopMode === "all" ? "列表循环" : loopMode === "one" ? "单曲循环" : "不循环";
      const icon = btn.querySelector("i");
      if (icon) icon.className = loopMode === "one" ? "fas fa-redo" : "fas fa-repeat";
    }
    syncDockLoopBtn(); persistNow();
  }

  // 修改2：移动端点击展开时，主动判断展开后的尺寸卡片是否越界，做位置补偿






  /** 是否贴在左右吸附区（不依赖 is-docked class，避免竞态） */
  function isNearDockEdge() {
    if (!root) return null;
    const { leftBase, w, leftX, rightX, vw } = getSnapTargets();
    const { enter } = getSnapDistances();
    const absLeft = leftBase + posX;
    const absRight = absLeft + w;
    const th = enter + 20;
    if (absLeft < th || Math.abs(posX - leftX) < 10) return "left";
    if (absRight > vw - th || Math.abs(posX - rightX) < 10) return "right";
    return null;
  }

  /** 理想贴边坐标（永远用 leftX/rightX，不用可能已被污染的 pos） */
  function idealDockPos(side) {
    const { leftX, rightX } = getSnapTargets();
    const x = side === "right" ? rightX : leftX;
    const ball = getBallSize();
    const [, y] = clampPosition(x, posY, ball, ball);
    return { x, y };
  }

  function lockDockAnchor(side) {
    if (!side) return;
    const p = idealDockPos(side);
    dockAnchorX = p.x;
    dockAnchorY = p.y;
    posX = p.x;
    posY = p.y;
    lastDockSide = side;
    applyTransform();
  }

  function restoreDockAnchor() {
    const side = lastDockSide || isNearDockEdge() || (root && root.classList.contains("dock-right") ? "right" : root && root.classList.contains("dock-left") ? "left" : null);
    if (!side) return false;
    const p = idealDockPos(side);
    const changed = Math.abs(posX - p.x) > 0.5 || Math.abs(posY - p.y) > 0.5;
    posX = p.x;
    posY = p.y;
    dockAnchorX = p.x;
    dockAnchorY = p.y;
    if (changed) applyTransform();
    return changed;
  }


  function getMobileCardSize() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(vw * 0.72, 260);
    const h = Math.min(vh * 0.34, 210);
    return { w: Math.max(180, Math.round(w)), h: Math.max(140, Math.round(h)) };
  }

  function prepareMobileOpen() {
    if (!root || !isMobile) return;
    if (root.classList.contains("is-docked") || root.classList.contains("is-dock-closing")) return;
    if (lastDockSide || (typeof isNearDockEdge === "function" && isNearDockEdge())) return;
    if (typeof dockAnchorX !== "undefined" && dockAnchorX != null) return;

    const { w: openW, h: openH } = getMobileCardSize();
    const leftBase = parseFloat(getComputedStyle(root).left) || 20;
    const ballW = getBallSize();
    const vw = window.innerWidth;
    const pad = 8;
    let absLeft = leftBase + posX;
    let expandLeft = false;
    if (absLeft + openW <= vw - pad) expandLeft = false;
    else if (absLeft + ballW - openW >= pad) expandLeft = true;
    else {
      expandLeft = true;
      const minAbs = pad - ballW + openW;
      const maxAbs = vw - pad - ballW;
      absLeft = clamp(Math.max(absLeft, minAbs), Math.min(minAbs, maxAbs), Math.max(minAbs, maxAbs));
      posX = absLeft - leftBase;
    }
    const [cx, cy] = clampPosition(posX, posY, ballW, openH);
    posX = cx;
    posY = cy;
    root.classList.toggle("expand-left", expandLeft);
    applyTransform();
  }


  function updateDockDirection() {
    if (!root) return;
    if (!isMobile || !root.classList.contains("is-docked")) {
      root.classList.remove("dock-down");
      return;
    }
    const rect = root.getBoundingClientRect();
    const n = root.querySelectorAll(".mp-dock-btn").length || 5;
    const stackH = n * 40 + (n - 1) * 8 + 12;
    if (rect.top < stackH + 8 && window.innerHeight - rect.bottom > rect.top) {
      root.classList.add("dock-down");
    } else {
      root.classList.remove("dock-down");
    }
  }

  /**
   * 移动端点球：
   * - 吸附态只开关 Dock，绝不做大卡片 clamp / 改坐标
   * - 关闭动画期间完全忽略（防鬼点击把「关」变成「开」）
   * - 关闭后 ignore 窗口 > 合成 click 常见延迟（~300ms）
   */
  function toggleMobileBall() {
    // 同一次手势 / 重入：只响应一次，避免「同时关又开」
    if (ballToggleBusy) return;
    const now = Date.now();
    if (now < ignoreBallToggleUntil) return;
    if (root && root.classList.contains("is-dock-closing")) return;

    ballToggleBusy = true;
    try {
      const near = isNearDockEdge();
      const docked = (root && root.classList.contains("is-docked")) || !!near || !!lastDockSide;
      // 以 DOM class 为准，避免 isOpen 与 class 不同步导致连击变成开
      const open = !!(root && root.classList.contains("is-open"));

      if (docked) {
        const side = near || lastDockSide || (root.classList.contains("dock-right") ? "right" : "left");
        if (!root.classList.contains("is-docked")) setDocked(side);
        else lockDockAnchor(side);

        if (open) {
          ignoreBallToggleUntil = now + 1000;
          setOpen(false);
        } else {
          ignoreBallToggleUntil = now + 450;
          lockDockAnchor(side);
          setOpen(true);
        }
        return;
      }

      ignoreBallToggleUntil = now + 450;
      setOpen(!open);
    } finally {
      // 微任务结束后再解锁，挡住同步重入
      setTimeout(() => { ballToggleBusy = false; }, 50);
    }
  }



  /** 向左展开关闭前：取消过渡，避免 margin/width 不同步造成球瞬移 */
  /**
   * 向左展开收起：
   * 关键：先去掉 expand-left 会立刻变成「向右展开布局」，球看起来先跳到左边。
   * 做法：先只关 is-open，保留 expand-left 直到 width 过渡结束，再摘 expand-left。
   */





  function setOpen(open) {
    open = !!open;
    if (!root) { isOpen = open; return; }
    if (open && root.classList.contains("is-dock-closing")) return;

    const near = typeof isNearDockEdge === "function" ? isNearDockEdge() : null;
    const docked = root.classList.contains("is-docked") || (isMobile && (!!near || !!lastDockSide));

    if (docked) {
      const side = near || lastDockSide || (root.classList.contains("dock-right") ? "right" : "left");
      if (!root.classList.contains("is-docked")) setDocked(side);
      else if (typeof lockDockAnchor === "function") lockDockAnchor(side);
      root.classList.remove("expand-left");

      if (!open) {
        isOpen = false;
        closeDockList();
        root.classList.add("is-dock-closing");
        root.classList.remove("is-open");
        if (typeof lockDockAnchor === "function") lockDockAnchor(side);
        ignoreBallToggleUntil = Math.max(ignoreBallToggleUntil || 0, Date.now() + 1000);
        clearTimeout(root._dockCloseTimer);
        root._dockCloseTimer = setTimeout(() => {
          if (!root) return;
          root.classList.remove("is-dock-closing");
          ignoreBallToggleUntil = Math.max(ignoreBallToggleUntil || 0, Date.now() + 400);
          if (typeof lockDockAnchor === "function") lockDockAnchor(side);
        }, 320);
        return;
      }

      isOpen = true;
      root.classList.remove("is-dock-closing");
      if (typeof lockDockAnchor === "function") lockDockAnchor(side);
      if (typeof updateDockDirection === "function") updateDockDirection();
      root.classList.add("is-docked");
      root.classList.add("is-open");
      return;
    }

    isOpen = open;
    if (isOpen) {
      root.classList.remove("is-dock-closing");
      if (isMobile && typeof prepareMobileOpen === "function") prepareMobileOpen();
      else if (typeof updateExpandDirection === "function") updateExpandDirection();
    } else {
      root.classList.remove("expand-left");
    }
    root.classList.toggle("is-open", isOpen);

    if (!isOpen) {
      if (isListOpen || root.classList.contains("is-list-open")) {
        isListOpen = false;
        closeListAnimated();
      } else {
        isListOpen = false;
        root.classList.remove("is-list-open", "is-list-closing");
      }
    }
  }


  function updateListDirection() {
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const listH = parseInt(getComputedStyle(root).getPropertyValue("--mp-list-h"), 10) || 280;
    const spaceBelow = window.innerHeight - rect.bottom, spaceAbove = rect.top;
    if (spaceBelow < listH + 16 && spaceAbove > spaceBelow) root.classList.add("list-up");
    else root.classList.remove("list-up");
  }

  function closeListAnimated() {
    if (!root) return;
    const list = $("#mp-list", root);
    if (list && root.classList.contains("is-list-open")) {
      list.style.maxHeight = (getComputedStyle(root).getPropertyValue("--mp-list-h").trim() || "280px");
      void list.offsetHeight;
    }
    root.classList.add("is-list-closing"); root.classList.remove("is-list-open");
    if (list) requestAnimationFrame(() => list.style.maxHeight = "0px");
    setTimeout(() => {
      if (!root) return;
      root.classList.remove("is-list-closing");
      if (!isListOpen) root.classList.remove("list-up");
      if (list) list.style.maxHeight = "";
    }, 420);
  }

  // 修改3：移动端直接屏蔽内联坐标注入，完全交给 CSS 的 fixed Bottom sheet 样式处理
  function positionDockList() {
    if (isMobile) {
      const panel = $("#mp-dock-list");
      if (panel) {
        panel.style.left = ''; panel.style.top = ''; panel.style.width = ''; panel.style.maxHeight = '';
      }
      return;
    }
    const panel = $("#mp-dock-list");
    if (!panel || !root) return;
    const btn = $("#mp-dock-list-btn");
    const anchor = (btn && btn.getBoundingClientRect().width) ? btn.getBoundingClientRect() : root.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight, gap = 10, pad = 8;
    const maxW = Math.min(320, vw - pad * 2), preferredH = Math.min(280, vh - pad * 2);
    const isLeft = root.classList.contains("dock-left");

    let left = isLeft ? Math.min(anchor.right + gap, Math.max(pad, vw - maxW - pad)) : Math.max(pad, anchor.left - gap - maxW);
    const spaceBelow = vh - pad - anchor.top, spaceAbove = anchor.bottom - pad;
    let top, maxH;

    if (spaceBelow >= preferredH || spaceBelow >= spaceAbove) {
      top = anchor.top; maxH = Math.min(preferredH, Math.max(120, spaceBelow));
      if (top + maxH > vh - pad) maxH = Math.max(120, vh - pad - top);
      panel.classList.remove("dock-list-up");
    } else {
      maxH = Math.min(preferredH, Math.max(120, spaceAbove)); top = anchor.bottom - maxH;
      if (top < pad) { top = pad; maxH = Math.max(120, anchor.bottom - pad); }
      panel.classList.add("dock-list-up");
    }
    panel.style.width = maxW + "px"; panel.style.maxHeight = maxH + "px"; panel.style.left = left + "px"; panel.style.top = top + "px";
  }

  // 修改4：放开限制，移动端强制允许打开 dockList（复用其成为全局 Bottom Sheet 歌单）
  function openDockList() {
    if (!isMobile && (!root || !root.classList.contains("is-docked"))) return;
    ensureDockListPanel();
    isDockListOpen = true;
    if (isMobile) setOpen(true);
    if (root) root.classList.add("dock-list-open");
    const panel = $("#mp-dock-list");
    if (panel) {
      panel.setAttribute("aria-hidden", "false");
      positionDockList();
      requestAnimationFrame(() => { positionDockList(); panel.classList.add("is-visible"); });
    }
    const btn = $("#mp-dock-list-btn");
    if (btn) btn.classList.add("active");
  }

  function closeDockList() {
    isDockListOpen = false;
    if (root) root.classList.remove("dock-list-open");
    const panel = $("#mp-dock-list");
    if (panel) { panel.classList.remove("is-visible"); panel.setAttribute("aria-hidden", "true"); }
    const btn = $("#mp-dock-list-btn");
    if (btn) btn.classList.remove("active");
  }

  function toggleDockList() {
    if (!isMobile && (!root || !root.classList.contains("is-docked"))) return toggleList();
    if (isDockListOpen) closeDockList(); else openDockList();
  }

  // 修改5：移动端点击列表按钮，自动路由到 toggleDockList
  function toggleList() {
    if (isMobile || (root && root.classList.contains("is-docked"))) return toggleDockList();
    if (!isOpen && isMobile) setOpen(true);
    isListOpen = !isListOpen;
    if (root) {
      if (isListOpen) {
        root.classList.remove("is-list-closing");
        updateListDirection(); updateExpandDirection();
        const list = $("#mp-list", root);
        if (list) list.style.maxHeight = "0px";
        root.classList.add("is-list-open");
        if (list) { void list.offsetHeight; list.style.maxHeight = ""; }
      } else {
        closeListAnimated();
      }
    }
  }

  function collapseToBall() {
    const wasListOpen = isListOpen || (root && root.classList.contains("is-list-open"));
    isListOpen = false;
    closeDockList();
    const near = typeof isNearDockEdge === "function" ? isNearDockEdge() : null;
    const docked = root && (root.classList.contains("is-docked") || near || lastDockSide);
    if (docked && (isOpen || (root && root.classList.contains("is-open")))) {
      ignoreBallToggleUntil = Date.now() + 1000;
      if (near && !root.classList.contains("is-docked")) setDocked(near);
      setOpen(false);
    } else if (isOpen || (root && root.classList.contains("is-open"))) {
      setOpen(false);
    } else if (root) {
      root.classList.remove("is-open", "is-dock-closing");
      // expand-left 在 setOpen(false) 中清除
      if (!root.classList.contains("is-open")) root.classList.remove("expand-left");
    }
    if (root) {
      if (wasListOpen) closeListAnimated();
      else root.classList.remove("is-list-open", "is-list-closing", "list-up");
    }
  }

  function onPlayerMouseLeave(e) {
    if (dragging) return;
    const related = e && e.relatedTarget;
    if (related && ((root && root.contains(related)) || (document.getElementById("mp-dock-list")?.contains(related)))) return;
    collapseToBall();
    if (root) root.classList.remove("no-hover-expand");
  }




  function endDragSession(commitSnap) {
    clearTimeout(longPressTimer); longPressTimer = null;
    document.removeEventListener("pointermove", onDocPointerMove); document.removeEventListener("pointerup", onDocPointerUp); document.removeEventListener("pointercancel", onDocPointerUp);
    if (activePointer != null && coverEl) { try { if (coverEl.hasPointerCapture && coverEl.hasPointerCapture(activePointer)) coverEl.releasePointerCapture(activePointer); } catch (err) {} }
    const wasDrag = wasDragging || dragging;
    dragging = false; longPressTriggered = false; activePointer = null; pointerId = null;
    if (root) root.classList.remove("is-dragging");
    if (wasDrag) { collapseToBall(); if (root) root.classList.add("no-hover-expand"); if (commitSnap) snapToEdge(); }
    wasDragging = false;
    return wasDrag;
  }

  function onCoverPointerDown(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    ballGestureId = null; // 新手势允许一次 toggle
    if (!coverEl || (e.target !== coverEl && !coverEl.contains(e.target))) return;
    if (activePointer != null) return;
    activePointer = e.pointerId; pointerId = e.pointerId;
    startClientX = e.clientX; startClientY = e.clientY; originX = posX; originY = posY;
    moveDist = 0; dragging = false; wasDragging = false; longPressTriggered = false; magnetSide = null;
    if (root) root.classList.remove("is-magnet", "magnet-left", "magnet-right", "is-snapping");
    document.addEventListener("pointermove", onDocPointerMove, { passive: false });
    document.addEventListener("pointerup", onDocPointerUp, { passive: false });
    document.addEventListener("pointercancel", onDocPointerUp, { passive: false });

    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
      if (activePointer == null) return;
      longPressTriggered = true; dragging = true; wasDragging = true;
      collapseToBall(); setDocked(null);
      if (root) { root.classList.add("is-dragging", "no-hover-expand"); }
      try { coverEl.setPointerCapture(activePointer); } catch (err) {}
    }, CONFIG.longPressMs);
  }

  function onDocPointerMove(e) {
    if (activePointer == null || e.pointerId !== activePointer) return;
    if (e.pointerType === "mouse" && e.buttons === 0) return endDragSession(wasDragging || dragging);
    const dx = e.clientX - startClientX, dy = e.clientY - startClientY;
    moveDist = Math.sqrt(dx * dx + dy * dy);

    if (!dragging && moveDist > CONFIG.clickThreshold) {
      clearTimeout(longPressTimer); longPressTimer = null; dragging = true; wasDragging = true;
      collapseToBall(); setDocked(null);
      if (root) root.classList.add("is-dragging", "no-hover-expand");
      try { coverEl.setPointerCapture(activePointer); } catch (err) {}
    }
    if (!dragging) return;
    e.preventDefault();
    let freeX = applyMagneticX(originX + dx, e.clientX);
    const [nx, ny] = clampPosition(freeX, originY + dy);
    posX = nx; posY = ny; applyTransform();
  }

  // 修改6：触控优化，去除了移动端容易误触的双击，统一为：短按 -> 开关控制卡片；长按 -> 拖拽。
  function onDocPointerUp(e) {
    if (activePointer == null || e.pointerId !== activePointer) return;
    const pid = e.pointerId;
    const wasDrag = endDragSession(true);
    if (wasDrag) {
      try { e.preventDefault(); e.stopPropagation(); } catch (err) {}
      return;
    }

    try { e.preventDefault(); e.stopPropagation(); } catch (err) {}

    // 同一 pointer 手势只处理一次（防止 pointerup + cancel 或重复监听）
    if (ballGestureId === pid) return;
    ballGestureId = pid;
    setTimeout(() => { if (ballGestureId === pid) ballGestureId = null; }, 600);

    if (isMobile) toggleMobileBall();
    else togglePlay();
  }


  function bindEvents() {
    if (!coverEl) return;
    coverEl.addEventListener("pointerdown", onCoverPointerDown);
    // 文档捕获阶段吞掉关闭后的合成 click（比只挡 cover 更稳）
    if (!window.__mpGhostClickBlocker) {
      window.__mpGhostClickBlocker = true;
      document.addEventListener("click", (e) => {
        if (Date.now() < ignoreBallToggleUntil) {
          e.preventDefault();
          e.stopPropagation();
        }
      }, true);
    }
    // 屏蔽 touch 后的合成 click，避免关闭 Dock 后又触发一次打开
    coverEl.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    root.addEventListener("mouseleave", onPlayerMouseLeave);
    root.addEventListener("mouseenter", () => {
      if (!isMobile) updateExpandDirection();
    });
    const dockPanel = ensureDockListPanel();
    dockPanel.addEventListener("mouseleave", (e) => {
      const related = e.relatedTarget;
      if (related && ((root && root.contains(related)) || dockPanel.contains(related))) return;
      onPlayerMouseLeave(e);
    });

    const bindClick = (sel, fn) => { const el = $(sel, root); if (el) el.addEventListener("click", (e) => { e.stopPropagation(); fn(e); }); };

    bindClick("#mp-play", () => togglePlay());
    bindClick("#mp-dock-play", () => togglePlay()); // 新增：点击 Dock 的播放按钮控制播放
    bindClick("#mp-prev", () => playPrev());
    bindClick("#mp-next", () => playNext(true));
    bindClick("#mp-list-btn", () => toggleList());
    bindClick("#mp-loop", () => toggleLoop());
    bindClick("#mp-dock-prev", () => playPrev());
    bindClick("#mp-dock-next", () => playNext(true));
    bindClick("#mp-dock-loop", () => toggleLoop());
    bindClick("#mp-dock-list-btn", () => toggleDockList());

    const progress = $("#mp-progress", root);
    if (progress) progress.addEventListener("click", (e) => { e.stopPropagation(); seek((e.clientX - progress.getBoundingClientRect().left) / progress.getBoundingClientRect().width); });

    const onListItemClick = (e) => {
      const item = e.target.closest(".mp-list-item"); if (!item) return;
      const idx = parseInt(item.dataset.index, 10); if (isNaN(idx)) return;
      loadSong(idx, true);
      if (isDockListOpen && isMobile) closeDockList(); // 移动端点选后自动收起
    };
    if (listInner) listInner.addEventListener("click", onListItemClick);
    const dockInner = $("#mp-dock-list-inner");
    if (dockInner) dockInner.addEventListener("click", onListItemClick);

    document.addEventListener("pointerdown", (e) => {
      if (!isDockListOpen) return;
      const panel = $("#mp-dock-list"), dockBtn = $("#mp-dock-list-btn");
      if ((panel && panel.contains(e.target)) || (dockBtn && dockBtn.contains(e.target)) || (root && root.contains(e.target))) return;
      closeDockList();
    }, { passive: true });

    document.addEventListener("pointerdown", (e) => {
      if (!isMobile || (!isOpen && !isListOpen)) return;
      if (root && !root.contains(e.target)) {
        // 增加对 dock-list (底边抽屉) 的点击放行
        const dockList = document.getElementById("mp-dock-list");
        if (dockList && dockList.contains(e.target)) return;
        collapseToBall();
      }
    }, { passive: true });

    window.addEventListener("resize", () => {
      // 当发生旋转等行为时重新更新 mobile 标志
      isMobile = window.innerWidth <= 600;
      const [nx, ny] = clampPosition(posX, posY);
      posX = nx; posY = ny; applyTransform(); syncDockFromPosition(); if (isDockListOpen) positionDockList();
    });
    window.addEventListener("beforeunload", persistNow);
  }

  let initialized = false, eventsBound = false;

  function cacheDOMRefs() {
    coverEl = $("#mp-cover", root); titleEl = $("#mp-title", root); artistEl = $("#mp-artist", root);
    playedEl = $("#mp-played", root); timeEl = $("#mp-time", root); listInner = $("#mp-list-inner", root);
    playBtnIcon = $("#mp-play i", root);
    dockPlayBtnIcon = $("#mp-dock-play i", root);
  }

  function ensureVisibleOnScreen() {
    if (!root) return;
    root.style.cssText += ";display:block;visibility:visible;opacity:1;pointer-events:auto;z-index:99999;";
    const fix = () => {
      const before = { x: posX, y: posY }, [nx, ny] = clampPosition(posX, posY);
      posX = nx; posY = ny; applyTransform();
      if (Math.abs(before.x - nx) > 2 || Math.abs(before.y - ny) > 2) persistNow();
      const rect = root.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight;
      if (rect.bottom < 0 || rect.top > vh || rect.right < 0 || rect.left > vw) { posX = 0; posY = 0; applyTransform(); persistNow(); }
      syncDockFromPosition();
    };
    requestAnimationFrame(() => requestAnimationFrame(fix));
  }

  async function init() {
    if (!document.body) return setTimeout(init, 50);
    isMobile = window.innerWidth <= 600;
    loadPersisted();
    root = createPlayerDOM(); ensureDockListPanel(); cacheDOMRefs();
    if (!coverEl) return;
    ensureVisibleOnScreen();
    if (!eventsBound) { bindEvents(); eventsBound = true; }

    const loopBtn = $("#mp-loop", root);
    if (loopBtn) {
      loopBtn.classList.toggle("active", loopMode !== "none");
      const icon = loopBtn.querySelector("i");
      if (icon) icon.className = loopMode === "one" ? "fas fa-redo" : "fas fa-repeat";
    }

    if (initialized && playlist.length) return updateMeta();
    initialized = true;

    try {
      playlist = await fetchPlaylist(); renderList();
      const s = getState();
      if (s.index != null && s.index < playlist.length) currentIndex = s.index;
      loadSong(currentIndex, false);
      if (s.time && audio) {
        const seekTo = () => { if (audio.readyState >= 1) { audio.currentTime = s.time; updateProgress(); audio.removeEventListener("loadedmetadata", seekTo); } };
        audio.addEventListener("loadedmetadata", seekTo);
      }
    } catch (err) {
      if (titleEl) titleEl.textContent = "加载失败"; if (artistEl) artistEl.textContent = "请检查网络或 API";
      if (listInner) listInner.innerHTML = '<div class="mp-empty">歌单加载失败</div>';
    }

    new MutationObserver(() => {
      const existing = document.getElementById("music-player");
      if (!existing || !document.body.contains(existing)) { if (root) { document.body.appendChild(root); ensureVisibleOnScreen(); } else init(); }
    }).observe(document.body, { childList: true });
  }

  function boot() {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
    document.addEventListener("pjax:complete", () => { setTimeout(() => { if (!document.getElementById("music-player")) { initialized = false; eventsBound = false; init(); } else ensureVisibleOnScreen(); }, 30); });
  }
  boot();
})();