/**
 * Floating Music Player — Hexo Butterfly
 * ---------------------------------------------------------------------------
 * Architecture phase 1–2: shell state machine + projection; reads use shell helpers.
 * Interaction & CSS design language are preserved; class names stay stable.
 * - State is the source of truth for shell modes (ball / panel / dock).
 * - projectShell() is the only writer for core shell classes on #music-player.
 * - High-frequency pointer coordinates remain outside the store (posX/posY).
 * ---------------------------------------------------------------------------
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


  /** @typedef {"ball"|"panel"|"dock"} ShellMode */

  const MODE = {
    BALL: "ball",
    PANEL: "panel",
    DOCK: "dock"
  };

  /**
   * Shell state — low-frequency UI mode machine.
   * CSS classes are a projection of this object (see projectShell).
   */
  const shell = {
    mode: "ball",           // ball | panel | dock
    dockSide: null,         // left | right | null
    dockExpanded: false,    // dock 功能球是否展开
    dockClosing: false,
    expandLeft: false,
    dragging: false,
    snapping: false,
    playing: false,
    listOpen: false,
    listClosing: false,
    listUp: false,
    dockListOpen: false,
    dockDown: false,
    mobile: false,
    noHoverExpand: false,
    magnet: null            // left | right | null
  };

  /**
   * Normalize illegal combinations only.
   * IMPORTANT: Desktop hover keeps mode=ball while CSS :hover shows the bar.
   * expandLeft + listOpen must remain valid in BALL mode (do not wipe them).
   */
  function normalizeShell() {
    if (shell.dragging) {
      if (shell.mode === MODE.PANEL) shell.mode = MODE.BALL;
      shell.dockExpanded = false;
      shell.dockClosing = false;
      shell.listOpen = false;
      shell.listClosing = false;
      // expandLeft 拖动中可清，避免收起动画错位
      shell.expandLeft = false;
    }

    if (shell.mode === MODE.DOCK) {
      // Dock 不用控制栏向左展开 / 内嵌歌单
      shell.expandLeft = false;
      shell.listOpen = false;
      shell.listClosing = false;
      shell.listUp = false;
    } else {
      // 非 Dock：清掉 Dock 专有字段
      shell.dockSide = null;
      shell.dockExpanded = false;
      shell.dockClosing = false;
      shell.dockDown = false;
      shell.dockListOpen = false;
    }
  }

  /**
   * Unique writer for core shell classes on #music-player.
   * Keeps existing CSS selectors working unchanged.
   */
  function projectShell() {
    if (!root) return;
    normalizeShell();
    const c = root.classList;
    const isDock = shell.mode === MODE.DOCK;
    const isPanel = shell.mode === MODE.PANEL;
    // 与历史语义对齐：panel 展开或 dock 功能球展开都带 is-open
    const openClass = isPanel || (isDock && shell.dockExpanded);

    c.toggle("is-docked", isDock);
    c.toggle("dock-left", isDock && shell.dockSide === "left");
    c.toggle("dock-right", isDock && shell.dockSide === "right");
    c.toggle("is-open", openClass);
    c.toggle("is-dock-closing", isDock && shell.dockClosing);
    c.toggle("expand-left", !!shell.expandLeft && !isDock);
    c.toggle("is-dragging", !!shell.dragging);
    c.toggle("is-snapping", !!shell.snapping);
    c.toggle("is-playing", !!shell.playing);
    c.toggle("is-list-open", !!shell.listOpen);
    c.toggle("is-list-closing", !!shell.listClosing);
    c.toggle("list-up", !!shell.listUp);
    c.toggle("dock-list-open", !!shell.dockListOpen);
    c.toggle("dock-down", !!shell.dockDown);
    c.toggle("is-mobile", !!shell.mobile);
    c.toggle("no-hover-expand", !!shell.noHoverExpand);
    c.toggle("is-magnet", shell.magnet === "left" || shell.magnet === "right");
    c.toggle("magnet-left", shell.magnet === "left");
    c.toggle("magnet-right", shell.magnet === "right");

    // 兼容旧布尔位（供尚未迁移的分支读取）
    isOpen = openClass;
  }

  function patchShell(partial) {
    Object.assign(shell, partial);
    projectShell();
  }

  /** Read helpers — prefer shell over classList */
  function isDockedMode() {
    return shell.mode === MODE.DOCK;
  }
  function isPanelMode() {
    return shell.mode === MODE.PANEL;
  }
  function isShellOpen() {
    return shell.mode === MODE.PANEL || (shell.mode === MODE.DOCK && shell.dockExpanded);
  }
  function dockSideNow() {
    return shell.dockSide || lastDockSide || null;
  }



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
  /* dock / gesture */
  let ignoreBallToggleUntil = 0;
  let dockAnchorX = null;
  let dockAnchorY = null;
  let lastDockSide = null;
  let ballGestureId = null;
  let ballToggleBusy = false;
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
  let dockPlayBtnIcon = null;

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

  // === interaction: magnet / snap ===
  function applyMagneticX(freeX, clientX) {
    if (!root) return freeX;
    const { leftBase, w, leftX, rightX, vw } = getSnapTargets();
    const { enter, leave } = getSnapDistances();
    const absLeft = leftBase + freeX;
    const absRight = absLeft + w;

    if (magnetSide === "left") {
      let tentative = originX + (clientX - startClientX);
      if (tentative < leftX) { originX = leftX - (clientX - startClientX); return leftX; }
      if (tentative - leftX >= leave) { magnetSide = null; patchShell({ magnet: null }); return tentative; }
      return leftX;
    }
    if (magnetSide === "right") {
      let tentative = originX + (clientX - startClientX);
      if (tentative > rightX) { originX = rightX - (clientX - startClientX); return rightX; }
      if (rightX - tentative >= leave) { magnetSide = null; patchShell({ magnet: null }); return tentative; }
      return rightX;
    }
    if (absLeft < enter) {
      magnetSide = "left"; originX = leftX - (clientX - startClientX);
      patchShell({ magnet: "left" });
      return leftX;
    }
    if (absRight > vw - enter) {
      magnetSide = "right"; originX = rightX - (clientX - startClientX);
      patchShell({ magnet: "right" });
      return rightX;
    }
    return freeX;
  }

  // === interaction: dock ===
  function setDocked(side) {
    if (!root) return;
    if (side === "left" || side === "right") {
      lastDockSide = side;
      lockDockAnchor(side);
      // 进入 Dock 后允许 hover 展开功能球（清掉拖拽结束留下的 no-hover-expand）
      patchShell({
        mode: MODE.DOCK,
        dockSide: side,
        expandLeft: false,
        dockClosing: false,
        dockExpanded: false,
        noHoverExpand: false
      });
      syncDockLoopBtn();
      if (typeof updateDockDirection === "function") updateDockDirection();
    } else {
      closeDockList();
      if (!dragging) {
        dockAnchorX = null;
        dockAnchorY = null;
        lastDockSide = null;
      }
      // 离开 Dock：保留当前 mode 若已是 PANEL；否则回 BALL
      const keepPanel = shell.mode === MODE.PANEL;
      patchShell({
        mode: keepPanel ? MODE.PANEL : MODE.BALL,
        dockSide: null,
        dockExpanded: false,
        dockClosing: false,
        dockDown: false,
        dockListOpen: false
      });
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
    patchShell({ magnet: null });

    if (moved) {
      patchShell({ snapping: true });
      applyTransform();
      setTimeout(() => { patchShell({ snapping: false }); }, 400);
    } else {
      applyTransform();
    }
    setDocked(finalSide);
    updateExpandDirection();
    persistNow();
  }

  function updateExpandDirection() {
    if (!root || isDockedMode() || dragging) {
      if (shell.expandLeft) patchShell({ expandLeft: false });
      return;
    }
    if (isMobile && (isOpen || shell.mode === MODE.PANEL)) return;

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
    const need = absLeft + openW > vw - 12;
    if (need !== shell.expandLeft) patchShell({ expandLeft: need });
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
    shell.mobile = window.innerWidth <= 600;
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
    if (dockPlayBtnIcon) dockPlayBtnIcon.className = iconClass;
    patchShell({ playing: isPlaying });
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

  // === media: audio engine ===
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
    const side = lastDockSide || isNearDockEdge() || dockSideNow();
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
    if (isDockedMode() || shell.dockClosing) return;
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
    if (expandLeft !== shell.expandLeft) patchShell({ expandLeft: expandLeft });
    applyTransform();
  }

  function updateDockDirection() {
    if (!root) return;
    if (!isMobile || shell.mode !== MODE.DOCK) {
      if (shell.dockDown) patchShell({ dockDown: false });
      return;
    }
    const rect = root.getBoundingClientRect();
    const n = root.querySelectorAll(".mp-dock-btn").length || 5;
    const stackH = n * 40 + (n - 1) * 8 + 12;
    const down = rect.top < stackH + 8 && window.innerHeight - rect.bottom > rect.top;
    if (down !== shell.dockDown) patchShell({ dockDown: down });
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
    if (shell.dockClosing) return;

    ballToggleBusy = true;
    try {
      const near = isNearDockEdge();
      const docked = isDockedMode() || !!near || !!lastDockSide;
      // 以 DOM class 为准，避免 isOpen 与 class 不同步导致连击变成开
      const open = isShellOpen();

      if (docked) {
        const side = near || lastDockSide || dockSideNow() || "left";
        if (!isDockedMode()) setDocked(side);
        else lockDockAnchor(side);

        if (open) {
          ignoreBallToggleUntil = now + 650;
          setOpen(false);
        } else {
          ignoreBallToggleUntil = now + 300;
          lockDockAnchor(side);
          setOpen(true);
        }
        return;
      }

      ignoreBallToggleUntil = now + 300;
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
    if (!root) {
      isOpen = open;
      return;
    }
    if (open && shell.dockClosing) return;

    const near = typeof isNearDockEdge === "function" ? isNearDockEdge() : null;
    const docked = isDockedMode() || (isMobile && (!!near || !!lastDockSide));

    if (docked) {
      const side = near || lastDockSide || dockSideNow() || "left";
      if (!isDockedMode() || shell.dockSide !== side) {
        setDocked(side);
      } else if (typeof lockDockAnchor === "function") {
        lockDockAnchor(side);
      }

      if (!open) {
        closeDockList();
        if (typeof lockDockAnchor === "function") lockDockAnchor(side);
        ignoreBallToggleUntil = Math.max(ignoreBallToggleUntil || 0, Date.now() + 650);
        patchShell({
          mode: MODE.DOCK,
          dockSide: side,
          dockExpanded: false,
          dockClosing: true
        });
        clearTimeout(root._dockCloseTimer);
        root._dockCloseTimer = setTimeout(() => {
          if (!root) return;
          patchShell({ dockClosing: false });
          ignoreBallToggleUntil = Math.max(ignoreBallToggleUntil || 0, Date.now() + 250);
          if (typeof lockDockAnchor === "function") lockDockAnchor(side);
        }, 320);
        return;
      }

      if (typeof lockDockAnchor === "function") lockDockAnchor(side);
      if (typeof updateDockDirection === "function") updateDockDirection();
      patchShell({
        mode: MODE.DOCK,
        dockSide: side,
        dockExpanded: true,
        dockClosing: false
      });
      return;
    }

    // 非吸附：PANEL / BALL
    if (open) {
      // 先算 expandLeft，再进入 PANEL（桌面强制展开 / 移动端卡片）
      if (isMobile && typeof prepareMobileOpen === "function") prepareMobileOpen();
      else if (typeof updateExpandDirection === "function") updateExpandDirection();
      patchShell({
        mode: MODE.PANEL,
        dockExpanded: false,
        dockClosing: false,
        expandLeft: !!shell.expandLeft
      });
    } else {
      // 收起为 BALL；保留 expandLeft 供下次 hover 方向判断，由 updateExpandDirection 重算
      isListOpen = false;
      patchShell({
        mode: MODE.BALL,
        listOpen: false,
        listClosing: false
      });
      if (shell.listOpen) closeListAnimated();
      if (typeof updateExpandDirection === "function") updateExpandDirection();
    }
  }

  function updateListDirection() {
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const listH = parseInt(getComputedStyle(root).getPropertyValue("--mp-list-h"), 10) || 280;
    const spaceBelow = window.innerHeight - rect.bottom, spaceAbove = rect.top;
    const up = spaceBelow < listH + 16 && spaceAbove > spaceBelow;
    if (up !== shell.listUp) patchShell({ listUp: up });
  }

  function closeListAnimated() {
    if (!root) return;
    const list = $("#mp-list", root);
    if (list && shell.listOpen) {
      list.style.maxHeight = (getComputedStyle(root).getPropertyValue("--mp-list-h").trim() || "280px");
      void list.offsetHeight;
    }
    patchShell({ listClosing: true, listOpen: false });
    if (list) requestAnimationFrame(() => list.style.maxHeight = "0px");
    setTimeout(() => {
      if (!root) return;
      patchShell({ listClosing: false, listUp: isListOpen ? shell.listUp : false });
      if (list) list.style.maxHeight = "";
    }, 420);
  }

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
    const isLeft = (dockSideNow() || "left") === "left";

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

  function openDockList() {
    if (!isMobile && !isDockedMode()) return;
    ensureDockListPanel();
    isDockListOpen = true;
    if (isMobile) setOpen(true);
    patchShell({ dockListOpen: true });
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
    patchShell({ dockListOpen: false });
    const panel = $("#mp-dock-list");
    if (panel) { panel.classList.remove("is-visible"); panel.setAttribute("aria-hidden", "true"); }
    const btn = $("#mp-dock-list-btn");
    if (btn) btn.classList.remove("active");
  }

  function toggleDockList() {
    if (!isMobile && !isDockedMode()) return toggleList();
    if (isDockListOpen) closeDockList(); else openDockList();
  }

  function toggleList() {
    if (isMobile || isDockedMode()) return toggleDockList();
    if (!isOpen && isMobile) setOpen(true);
    isListOpen = !isListOpen;
    if (root) {
      if (isListOpen) {
        patchShell({ listClosing: false });
        updateListDirection(); updateExpandDirection();
        const list = $("#mp-list", root);
        if (list) list.style.maxHeight = "0px";
        patchShell({ listOpen: true, listClosing: false });
        if (list) { void list.offsetHeight; list.style.maxHeight = ""; }
      } else {
        closeListAnimated();
      }
    }
  }

  function collapseToBall() {
    const wasListOpen = isListOpen || shell.listOpen;
    isListOpen = false;
    closeDockList();
    const near = typeof isNearDockEdge === "function" ? isNearDockEdge() : null;
    const docked = isDockedMode() || !!near || !!lastDockSide;
    if (docked && isShellOpen()) {
      ignoreBallToggleUntil = Date.now() + 650;
      if (near && !isDockedMode()) setDocked(near);
      setOpen(false);
    } else if (isShellOpen()) {
      setOpen(false);
    } else if (root) {
      patchShell({ mode: MODE.BALL, dockExpanded: false, dockClosing: false, expandLeft: false });
    }
    if (root) {
      if (wasListOpen) closeListAnimated();
      else patchShell({ listOpen: false, listClosing: false, listUp: false });
    }
  }

  function onPlayerMouseLeave(e) {
    if (dragging) return;
    const related = e && e.relatedTarget;
    if (related && ((root && root.contains(related)) || (document.getElementById("mp-dock-list")?.contains(related)))) return;
    collapseToBall();
    patchShell({ noHoverExpand: false });
  }

  function endDragSession(commitSnap) {
    clearTimeout(longPressTimer); longPressTimer = null;
    document.removeEventListener("pointermove", onDocPointerMove); document.removeEventListener("pointerup", onDocPointerUp); document.removeEventListener("pointercancel", onDocPointerUp);
    if (activePointer != null && coverEl) { try { if (coverEl.hasPointerCapture && coverEl.hasPointerCapture(activePointer)) coverEl.releasePointerCapture(activePointer); } catch (err) {} }
    const wasDrag = wasDragging || dragging;
    dragging = false; longPressTriggered = false; activePointer = null; pointerId = null;
    patchShell({ dragging: false });
    if (wasDrag) { collapseToBall(); patchShell({ noHoverExpand: true }); if (commitSnap) snapToEdge(); }
    wasDragging = false;
    return wasDrag;
  }

  // === interaction: pointer / gesture ===
  function onCoverPointerDown(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    ballGestureId = null; // 新手势允许一次 toggle
    if (!coverEl || (e.target !== coverEl && !coverEl.contains(e.target))) return;
    if (activePointer != null) return;
    activePointer = e.pointerId; pointerId = e.pointerId;
    startClientX = e.clientX; startClientY = e.clientY; originX = posX; originY = posY;
    moveDist = 0; dragging = false; wasDragging = false; longPressTriggered = false; magnetSide = null;
    patchShell({ magnet: null, snapping: false });
    document.addEventListener("pointermove", onDocPointerMove, { passive: false });
    document.addEventListener("pointerup", onDocPointerUp, { passive: false });
    document.addEventListener("pointercancel", onDocPointerUp, { passive: false });

    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
      if (activePointer == null) return;
      longPressTriggered = true; dragging = true; wasDragging = true;
      collapseToBall(); setDocked(null);
      patchShell({ dragging: true, noHoverExpand: true });
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
      patchShell({ dragging: true, noHoverExpand: true });
      try { coverEl.setPointerCapture(activePointer); } catch (err) {}
    }
    if (!dragging) return;
    e.preventDefault();
    let freeX = applyMagneticX(originX + dx, e.clientX);
    const [nx, ny] = clampPosition(freeX, originY + dy);
    posX = nx; posY = ny; applyTransform();
  }

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
    bindClick("#mp-dock-play", () => togglePlay());
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
      isMobile = window.innerWidth <= 600; patchShell({ mobile: isMobile });
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
    isMobile = window.innerWidth <= 600; patchShell({ mobile: isMobile });
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
      if (!existing || !document.body.contains(existing)) { if (root) { document.body.appendChild(root);
    projectShell(); ensureVisibleOnScreen(); } else init(); }
    }).observe(document.body, { childList: true });
  }

  function boot() {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
    document.addEventListener("pjax:complete", () => { setTimeout(() => { if (!document.getElementById("music-player")) { initialized = false; eventsBound = false; init(); } else ensureVisibleOnScreen(); }, 30); });
  }
  boot();

  window.MusicPlayer = window.MusicPlayer || {};
  window.MusicPlayer.shellState = function () { return Object.assign({}, shell); };
  window.MusicPlayer.debug = function () {
    return {
      shell: Object.assign({}, shell),
      isOpen: isOpen,
      pos: { x: posX, y: posY },
      mobile: isMobile,
      playlist: playlist.length
    };
  };
})();