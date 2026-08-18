/**
 * Custom Floating Music Player for Hexo Butterfly
 * Pure JS + CSS, no APlayer. Playlist via Meting API.
 * Font Awesome Solid icons.
 */
(function () {
  "use strict";

  const CONFIG = {
    server: "netease",
    type: "playlist",
    id: "3778678",
    // Public Meting API (fallback chain)
    apis: [
      "https://api.injahow.cn/meting/?server=:server&type=:type&id=:id",
      "https://meting.mikus.ink/api?server=:server&type=:type&id=:id",
      "https://api.i-meto.com/meting/api?server=:server&type=:type&id=:id&r=:r"
    ],
    storageKey: "mp-state-v3",
    snapThreshold: 48, // px to snap to edge
    longPressMs: 420,
    clickThreshold: 14, // max move distance to still count as click (avoid hover jitter = drag)
    doubleTapMs: 280
  };

  // ---------- State ----------
  let audio = null;
  let playlist = [];
  let currentIndex = 0;
  let isPlaying = false;
  let volume = 0.7;
  let loopMode = "all"; // all | one | none
  let orderMode = "list"; // list | random
  let isOpen = false;
  let isListOpen = false;
  let isMobile = false;
  let posX = 0;
  let posY = 0;

  // Drag state
  let dragging = false;
  let wasDragging = false;
  let longPressTriggered = false;
  let startClientX = 0;
  let startClientY = 0;
  let originX = 0;
  let originY = 0;
  let moveDist = 0;
  let longPressTimer = null;
  let clickTimer = null;
  let lastTapTime = 0;
  let pointerId = null;

  // DOM refs
  let root = null;
  let coverEl = null;
  let titleEl = null;
  let artistEl = null;
  let playedEl = null;
  let timeEl = null;
  let listInner = null;
  let playBtnIcon = null;

  // ---------- Utils ----------
  function $(sel, ctx) {
    return (ctx || document).querySelector(sel);
  }

  function isTouchDevice() {
    return "ontouchstart" in window || navigator.maxTouchPoints > 0;
  }

  function formatTime(sec) {
    if (!isFinite(sec) || sec < 0) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function getState() {
    try {
      return JSON.parse(localStorage.getItem(CONFIG.storageKey)) || {};
    } catch (e) {
      return {};
    }
  }

  function saveState(partial) {
    try {
      const old = getState();
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(Object.assign({}, old, partial)));
    } catch (e) {}
  }

  function loadPersisted() {
    const s = getState();
    // Raw position restored here; ensureVisibleOnScreen() will clamp into viewport
    if (s.position && typeof s.position.x === "number" && typeof s.position.y === "number") {
      posX = s.position.x;
      posY = s.position.y;
    }
    if (s.volume != null) volume = clamp(s.volume, 0, 1);
    if (s.loopMode) loopMode = s.loopMode;
    if (s.orderMode) orderMode = s.orderMode;
    if (s.index != null) currentIndex = s.index;
  }

  function persistNow() {
    saveState({
      position: { x: posX, y: posY },
      volume,
      loopMode,
      orderMode,
      index: currentIndex,
      time: audio ? audio.currentTime : 0
    });
  }

  // ---------- Position & Snap ----------
  function applyTransform() {
    if (!root) return;
    root.style.transform = "translate(" + posX + "px," + posY + "px)";
  }

  function clampPosition(x, y) {
    if (!root) return [x, y];
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = root.offsetWidth || 66;
    const h = root.offsetHeight || 66;
    const style = getComputedStyle(root);
    const leftBase = parseFloat(style.left) || 20;
    const bottomBase = parseFloat(style.bottom) || 20;
    const margin = 8;

    // Fixed + left + bottom: translate(x,y)
    //   absLeft = leftBase + x
    //   absTop  = vh - bottomBase - h + y
    // Keep fully (or mostly) inside viewport
    const minX = margin - leftBase;
    const maxX = vw - leftBase - w - margin;
    const minY = margin - vh + bottomBase + h; // move up limit
    const maxY = bottomBase - margin;          // move down limit (~0)

    return [clamp(x, minX, maxX), clamp(y, minY, maxY)];
  }

  function snapToEdge() {
    if (!root) return;
    const vw = window.innerWidth;
    const leftBase = parseFloat(getComputedStyle(root).left) || 20;
    const w = root.offsetWidth;
    // Absolute screen X of the left edge of the player
    const absLeft = leftBase + posX;
    const absRight = absLeft + w;
    let targetX = posX;

    // Snap to left
    if (absLeft < CONFIG.snapThreshold) {
      targetX = 16 - leftBase; // ~16px from left edge
    }
    // Snap to right
    else if (absRight > vw - CONFIG.snapThreshold) {
      targetX = vw - w - 16 - leftBase;
    }

    const [cx, cy] = clampPosition(targetX, posY);
    posX = cx;
    posY = cy;

    // Smooth snap animation
    root.style.transition = "transform 0.28s cubic-bezier(0.25, 0.8, 0.25, 1)";
    applyTransform();
    setTimeout(() => {
      if (root) root.style.transition = "";
    }, 300);

    persistNow();
  }

  // ---------- Meting fetch ----------
  function buildApiUrl(template) {
    return template
      .replace(":server", CONFIG.server)
      .replace(":type", CONFIG.type)
      .replace(":id", CONFIG.id)
      .replace(":r", String(Math.random()));
  }

  async function fetchPlaylist() {
    let lastErr = null;
    for (const api of CONFIG.apis) {
      try {
        const url = buildApiUrl(api);
        const res = await fetch(url, { mode: "cors" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return data.map((item, i) => ({
            name: item.name || item.title || "Unknown",
            artist: item.artist || item.author || "Unknown",
            url: item.url,
            pic: item.pic || item.cover || "",
            lrc: item.lrc || "",
            index: i
          }));
        }
      } catch (e) {
        lastErr = e;
        console.warn("[MusicPlayer] API failed:", api, e);
      }
    }
    throw lastErr || new Error("All Meting APIs failed");
  }

  // ---------- UI builders ----------
  function createPlayerDOM() {
    // Idempotent: reuse existing node if present
    let el = document.getElementById("music-player");
    if (el) {
      // ensure still attached to body
      if (!document.body.contains(el)) {
        document.body.appendChild(el);
      }
      return el;
    }

    el = document.createElement("div");
    el.id = "music-player";
    // is-mobile class only for narrow screens (hover expand is handled by CSS media queries)
    if (window.innerWidth <= 600) el.classList.add("is-mobile");

    // Inline only visibility/position fallbacks — width/height controlled by CSS (hover expand)
    el.style.cssText = [
      "position:fixed",
      "left:20px",
      "bottom:20px",
      "z-index:99999",
      "display:block",
      "visibility:visible",
      "opacity:1",
      "pointer-events:auto",
      "box-sizing:border-box"
    ].join(";");

    el.innerHTML = `
      <div class="mp-main">
        <div class="mp-cover" id="mp-cover">
          <div class="mp-cover-play"><i class="fas fa-play"></i></div>
        </div>
        <div class="mp-body">
          <div class="mp-meta">
            <div class="mp-title" id="mp-title">加载中...</div>
            <div class="mp-artist" id="mp-artist">—</div>
          </div>
          <div class="mp-controller">
            <div class="mp-progress-wrap" id="mp-progress">
              <div class="mp-progress-bar">
                <div class="mp-progress-played" id="mp-played"></div>
              </div>
            </div>
            <div class="mp-time" id="mp-time">0:00 / 0:00</div>
            <div class="mp-btns">
              <button class="mp-btn" id="mp-prev" type="button" title="上一首"><i class="fas fa-step-backward"></i></button>
              <button class="mp-btn" id="mp-play" type="button" title="播放/暂停"><i class="fas fa-play"></i></button>
              <button class="mp-btn" id="mp-next" type="button" title="下一首"><i class="fas fa-step-forward"></i></button>
              <button class="mp-btn" id="mp-list-btn" type="button" title="歌单"><i class="fas fa-list"></i></button>
              <button class="mp-btn" id="mp-loop" type="button" title="循环"><i class="fas fa-repeat"></i></button>
            </div>
          </div>
        </div>
      </div>
      <div class="mp-list" id="mp-list">
        <div class="mp-list-inner" id="mp-list-inner">
          <div class="mp-loading"><i class="fas fa-spinner"></i> 加载歌单...</div>
        </div>
      </div>
    `;
    document.body.appendChild(el);
    return el;
  }

  function updateCover(url) {
    if (coverEl) {
      coverEl.style.backgroundImage = url ? `url("${url}")` : "";
    }
  }

  function updateMeta() {
    if (!playlist.length) return;
    const song = playlist[currentIndex];
    if (titleEl) titleEl.textContent = song.name;
    if (artistEl) artistEl.textContent = song.artist;
    updateCover(song.pic);
    // highlight list
    if (listInner) {
      const items = listInner.querySelectorAll(".mp-list-item");
      items.forEach((item, i) => {
        item.classList.toggle("active", i === currentIndex);
      });
      const active = listInner.querySelector(".mp-list-item.active");
      if (active && isListOpen) {
        active.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }

  function updatePlayIcon() {
    const icon = playBtnIcon;
    if (!icon) return;
    icon.className = isPlaying ? "fas fa-pause" : "fas fa-play";
    if (root) root.classList.toggle("is-playing", isPlaying);
  }

  function updateProgress() {
    if (!audio || !playedEl || !timeEl) return;
    const cur = audio.currentTime || 0;
    const dur = audio.duration || 0;
    const pct = dur > 0 ? (cur / dur) * 100 : 0;
    playedEl.style.width = pct + "%";
    timeEl.textContent = formatTime(cur) + " / " + formatTime(dur);
  }

  function renderList() {
    if (!listInner) return;
    if (!playlist.length) {
      listInner.innerHTML = '<div class="mp-empty">歌单为空</div>';
      return;
    }
    listInner.innerHTML = playlist
      .map(
        (s, i) => `
      <div class="mp-list-item${i === currentIndex ? " active" : ""}" data-index="${i}">
        <span class="mp-list-index">${i + 1}</span>
        <div class="mp-list-info">
          <div class="mp-list-name">${escapeHtml(s.name)}</div>
          <div class="mp-list-artist">${escapeHtml(s.artist)}</div>
        </div>
      </div>`
      )
      .join("");
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ---------- Audio control ----------
  function ensureAudio() {
    if (audio) return audio;
    audio = new Audio();
    audio.preload = "metadata";
    audio.volume = volume;

    audio.addEventListener("timeupdate", updateProgress);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", () => {
      isPlaying = true;
      updatePlayIcon();
      persistNow();
    });
    audio.addEventListener("pause", () => {
      isPlaying = false;
      updatePlayIcon();
      persistNow();
    });
    audio.addEventListener("error", () => {
      console.warn("[MusicPlayer] audio error, skip to next");
      setTimeout(() => playNext(true), 800);
    });
    return audio;
  }

  function loadSong(index, autoPlay) {
    if (!playlist.length) return;
    currentIndex = ((index % playlist.length) + playlist.length) % playlist.length;
    const song = playlist[currentIndex];
    ensureAudio();
    audio.src = song.url;
    audio.load();
    updateMeta();
    persistNow();

    if (autoPlay) {
      const p = audio.play();
      if (p && p.catch) p.catch(() => {});
    }
  }

  function togglePlay() {
    ensureAudio();
    if (!audio.src && playlist.length) {
      loadSong(currentIndex, true);
      return;
    }
    if (audio.paused) {
      const p = audio.play();
      if (p && p.catch) p.catch(() => {});
    } else {
      audio.pause();
    }
  }

  function playNext(force) {
    if (!playlist.length) return;
    let next = currentIndex + 1;
    if (orderMode === "random") {
      next = Math.floor(Math.random() * playlist.length);
    }
    if (next >= playlist.length) {
      if (loopMode === "all" || force) next = 0;
      else return;
    }
    loadSong(next, true);
  }

  function playPrev() {
    if (!playlist.length) return;
    let prev = currentIndex - 1;
    if (prev < 0) prev = playlist.length - 1;
    loadSong(prev, true);
  }

  function onEnded() {
    if (loopMode === "one") {
      audio.currentTime = 0;
      audio.play().catch(() => {});
      return;
    }
    playNext(false);
  }

  function seek(ratio) {
    if (!audio || !isFinite(audio.duration)) return;
    audio.currentTime = clamp(ratio, 0, 1) * audio.duration;
    updateProgress();
  }

  function toggleLoop() {
    const modes = ["all", "one", "none"];
    const idx = modes.indexOf(loopMode);
    loopMode = modes[(idx + 1) % modes.length];
    const btn = $("#mp-loop");
    if (btn) {
      btn.classList.toggle("active", loopMode !== "none");
      btn.title = loopMode === "all" ? "列表循环" : loopMode === "one" ? "单曲循环" : "不循环";
      const icon = btn.querySelector("i");
      if (icon) {
        icon.className = loopMode === "one" ? "fas fa-redo" : "fas fa-repeat";
      }
    }
    persistNow();
  }

  // ---------- Expand / List ----------
  function setOpen(open) {
    isOpen = !!open;
    if (root) {
      root.classList.toggle("is-open", isOpen);
      if (!isOpen) {
        isListOpen = false;
        root.classList.remove("is-list-open");
      }
    }
  }

  function toggleList() {
    if (!isOpen && isMobile) setOpen(true);
    isListOpen = !isListOpen;
    if (root) {
      root.classList.toggle("is-list-open", isListOpen);
      // Force reflow so max-height transition works even after cache restore
      if (isListOpen) {
        const list = $("#mp-list");
        if (list) {
          list.style.maxHeight = "0px";
          void list.offsetHeight;
          list.style.maxHeight = "";
        }
      }
    }
  }

  // ---------- Drag (must NOT stick to cursor / must not move on hover) ----------
  let activePointer = null; // only set while button is down on cover

  function endDragSession(commitSnap) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
    document.removeEventListener("pointermove", onDocPointerMove);
    document.removeEventListener("pointerup", onDocPointerUp);
    document.removeEventListener("pointercancel", onDocPointerUp);

    if (activePointer != null && coverEl) {
      try {
        if (coverEl.hasPointerCapture && coverEl.hasPointerCapture(activePointer)) {
          coverEl.releasePointerCapture(activePointer);
        }
      } catch (err) {}
    }

    const wasDrag = wasDragging || dragging;
    dragging = false;
    longPressTriggered = false;
    activePointer = null;
    pointerId = null;
    if (root) root.classList.remove("is-dragging");

    if (wasDrag && commitSnap) {
      snapToEdge();
    }
    wasDragging = false;
    return wasDrag;
  }

  function onCoverPointerDown(e) {
    // Only primary button / touch
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (!coverEl || (e.target !== coverEl && !coverEl.contains(e.target))) return;

    // Ignore if already in a session
    if (activePointer != null) return;

    activePointer = e.pointerId;
    pointerId = e.pointerId;
    startClientX = e.clientX;
    startClientY = e.clientY;
    originX = posX;
    originY = posY;
    moveDist = 0;
    dragging = false;
    wasDragging = false;
    longPressTriggered = false;

    // Listen on document so we always get up/move even if cursor leaves
    document.addEventListener("pointermove", onDocPointerMove, { passive: false });
    document.addEventListener("pointerup", onDocPointerUp, { passive: false });
    document.addEventListener("pointercancel", onDocPointerUp, { passive: false });

    // Long-press to enter drag (mobile-friendly); desktop can also drag after threshold
    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
      if (activePointer == null) return;
      longPressTriggered = true;
      dragging = true;
      wasDragging = true;
      if (root) root.classList.add("is-dragging");
      try {
        coverEl.setPointerCapture(activePointer);
      } catch (err) {}
    }, CONFIG.longPressMs);
  }

  function onDocPointerMove(e) {
    if (activePointer == null || e.pointerId !== activePointer) return;

    // Critical: if mouse button released but we missed pointerup, abort
    if (e.pointerType === "mouse" && e.buttons === 0) {
      endDragSession(wasDragging || dragging);
      return;
    }

    const dx = e.clientX - startClientX;
    const dy = e.clientY - startClientY;
    moveDist = Math.sqrt(dx * dx + dy * dy);

    // Start drag only after meaningful movement while button is held
    if (!dragging && moveDist > CONFIG.clickThreshold) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
      dragging = true;
      wasDragging = true;
      if (root) root.classList.add("is-dragging");
      try {
        coverEl.setPointerCapture(activePointer);
      } catch (err) {}
    }

    if (!dragging) return;

    e.preventDefault();
    const [nx, ny] = clampPosition(originX + dx, originY + dy);
    posX = nx;
    posY = ny;
    applyTransform();
  }

  function onDocPointerUp(e) {
    if (activePointer == null || e.pointerId !== activePointer) return;

    const wasDrag = endDragSession(true);

    if (wasDrag) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Treat as click / tap (no drag occurred)
    const now = Date.now();
    if (isMobile) {
      if (now - lastTapTime < CONFIG.doubleTapMs) {
        clearTimeout(clickTimer);
        lastTapTime = 0;
        setOpen(!isOpen);
      } else {
        lastTapTime = now;
        clickTimer = setTimeout(() => {
          togglePlay();
          lastTapTime = 0;
        }, CONFIG.doubleTapMs);
      }
    } else {
      togglePlay();
    }
  }

  // ---------- Events binding ----------
  function bindEvents() {
    if (!coverEl) return;

    // Only pointerdown on cover; move/up on document while active
    coverEl.addEventListener("pointerdown", onCoverPointerDown);

    // Buttons (null-safe)
    const bindClick = (sel, fn) => {
      const el = $(sel, root);
      if (el) el.addEventListener("click", (e) => { e.stopPropagation(); fn(e); });
    };
    bindClick("#mp-play", () => togglePlay());
    bindClick("#mp-prev", () => playPrev());
    bindClick("#mp-next", () => playNext(true));
    bindClick("#mp-list-btn", () => toggleList());
    bindClick("#mp-loop", () => toggleLoop());

    // Progress seek
    const progress = $("#mp-progress", root);
    if (progress) {
      progress.addEventListener("click", (e) => {
        e.stopPropagation();
        const rect = progress.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        seek(ratio);
      });
    }

    // List click
    if (listInner) {
      listInner.addEventListener("click", (e) => {
        const item = e.target.closest(".mp-list-item");
        if (!item) return;
        const idx = parseInt(item.dataset.index, 10);
        if (!isNaN(idx)) loadSong(idx, true);
      });
    }

    // Outside click (mobile close)
    document.addEventListener(
      "pointerdown",
      (e) => {
        if (!isMobile || !isOpen) return;
        if (root && !root.contains(e.target)) {
          setOpen(false);
        }
      },
      { passive: true }
    );

    // Resize
    window.addEventListener("resize", () => {
      const [nx, ny] = clampPosition(posX, posY);
      posX = nx;
      posY = ny;
      applyTransform();
    });

    // Persist on leave
    window.addEventListener("beforeunload", persistNow);
  }

  // ---------- Init ----------
  let initialized = false;
  let eventsBound = false;

  function cacheDOMRefs() {
    coverEl = $("#mp-cover", root);
    titleEl = $("#mp-title", root);
    artistEl = $("#mp-artist", root);
    playedEl = $("#mp-played", root);
    timeEl = $("#mp-time", root);
    listInner = $("#mp-list-inner", root);
    playBtnIcon = $("#mp-play i", root);
  }

  function ensureVisibleOnScreen() {
    if (!root) return;
    // Force visible
    root.style.display = "block";
    root.style.visibility = "visible";
    root.style.opacity = "1";
    root.style.pointerEvents = "auto";
    root.style.zIndex = "99999";

    // Re-clamp after real size is known (fixes off-screen saved Y like 783)
    const fix = () => {
      const before = { x: posX, y: posY };
      const [nx, ny] = clampPosition(posX, posY);
      posX = nx;
      posY = ny;
      applyTransform();
      // If we had to correct a lot, persist so it won't jump off again next load
      if (Math.abs(before.x - nx) > 2 || Math.abs(before.y - ny) > 2) {
        persistNow();
      }
      // Double-check with getBoundingClientRect
      const rect = root.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (rect.bottom < 0 || rect.top > vh || rect.right < 0 || rect.left > vw) {
        posX = 0;
        posY = 0;
        applyTransform();
        persistNow();
      }
    };
    requestAnimationFrame(() => requestAnimationFrame(fix));
  }

  async function init() {
    if (!document.body) {
      setTimeout(init, 50);
      return;
    }

    isMobile = isTouchDevice() || window.innerWidth <= 600;
    loadPersisted();

    root = createPlayerDOM();
    cacheDOMRefs();

    if (!coverEl) {
      console.error("[MusicPlayer] DOM structure missing");
      return;
    }

    ensureVisibleOnScreen();

    if (!eventsBound) {
      bindEvents();
      eventsBound = true;
    }

    // Restore loop UI
    const loopBtn = $("#mp-loop", root);
    if (loopBtn) {
      loopBtn.classList.toggle("active", loopMode !== "none");
      const icon = loopBtn.querySelector("i");
      if (icon) icon.className = loopMode === "one" ? "fas fa-redo" : "fas fa-repeat";
    }

    // Only fetch playlist once
    if (initialized && playlist.length) {
      updateMeta();
      return;
    }
    initialized = true;

    try {
      playlist = await fetchPlaylist();
      renderList();

      const s = getState();
      if (s.index != null && s.index < playlist.length) {
        currentIndex = s.index;
      }
      loadSong(currentIndex, false);

      if (s.time && audio) {
        const seekTo = () => {
          if (audio.readyState >= 1) {
            audio.currentTime = s.time;
            updateProgress();
            audio.removeEventListener("loadedmetadata", seekTo);
          }
        };
        audio.addEventListener("loadedmetadata", seekTo);
      }
    } catch (err) {
      console.error("[MusicPlayer] failed to load playlist", err);
      if (titleEl) titleEl.textContent = "加载失败";
      if (artistEl) artistEl.textContent = "请检查网络或 API";
      if (listInner) listInner.innerHTML = '<div class="mp-empty">歌单加载失败</div>';
    }

    // Watch: if theme/PJAX accidentally removes the player, put it back
    const mo = new MutationObserver(() => {
      const existing = document.getElementById("music-player");
      if (!existing || !document.body.contains(existing)) {
        if (root) {
          document.body.appendChild(root);
          ensureVisibleOnScreen();
        } else {
          init();
        }
      }
    });
    mo.observe(document.body, { childList: true });
  }

  function boot() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
    // Butterfly PJAX
    document.addEventListener("pjax:complete", () => {
      setTimeout(() => {
        if (!document.getElementById("music-player")) {
          initialized = false;
          eventsBound = false;
          init();
        } else {
          ensureVisibleOnScreen();
        }
      }, 30);
    });
  }

  boot();

  // Expose API + debug helper
  window.MusicPlayer = {
    play: () => togglePlay(),
    next: () => playNext(true),
    prev: () => playPrev(),
    open: () => setOpen(true),
    close: () => setOpen(false),
    resetPosition: () => {
      posX = 0;
      posY = 0;
      applyTransform();
      persistNow();
      console.log("[MusicPlayer] position reset to (0,0)");
    },
    debug: () => {
      const el = document.getElementById("music-player");
      console.log({
        exists: !!el,
        inBody: el ? document.body.contains(el) : false,
        rect: el ? el.getBoundingClientRect() : null,
        pos: { x: posX, y: posY },
        playlist: playlist.length,
        state: getState()
      });
    }
  };
})();
