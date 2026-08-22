/*! Orbit / FWF bundled */
(function () {
"use strict";
var __modules = {};
var __cache = {};
function __require(k) {
  if (__cache[k]) return __cache[k];
  var m = { default: undefined };
  var factory = __modules[k];
  if (!factory) throw new Error('Module not found: ' + k);
  __cache[k] = m;
  factory(m, __require);
  return m;
}

/* ---- src/core/WidgetRegistry.js ---- */
__modules["src/core/WidgetRegistry.js"] = function (__mod, __require) {
/**
 * Orbit / FWF Core — WidgetRegistry (Definition Registry)
 *
 * Holds widget *definitions* only (id → definition).
 * Live instances belong to Orbit Instance Registry (v0.3+).
 * Legacy: registerWidget(id, { mount }) still valid.
 */

const registry = Object.create(null);

/**
 * @param {string} id
 * @param {{ mount: Function, label?: string, version?: string, defaults?: object, unmount?: Function }} widget
 */function registerWidget(id, widget) {
  if (!id || typeof id !== "string") {
    throw new Error("registerWidget requires a non-empty string id");
  }
  // M2 (Contract Alpha): ids must be namespaced / well-formed
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(id)) {
    throw new Error(
      "registerWidget id must match ^[a-z0-9][a-z0-9._-]*$ (got: " + id + ")"
    );
  }
  if (!widget || typeof widget.mount !== "function") {
    throw new Error("registerWidget requires mount()");
  }
  registry[id] = {
    id: id,
    label: typeof widget.label === "string" && widget.label ? widget.label : id,
    version: widget.version,
    defaults: widget.defaults,
    mount: widget.mount,
    unmount: widget.unmount,
    // M4 fix: preserve declared capabilities instead of dropping them,
    // so consumers can inspect a definition's contract surface.
    capabilities: widget.capabilities,
  };
}

/**
 * @param {string} id
 */function getWidget(id) {
  return registry[id] || null;
}

/**
 * @returns {string[]}
 */function listWidgets() {
  return Object.keys(registry);
}

/**
 * @param {string} id
 * @param {object} ctx
 */function mountWidget(id, ctx) {
  const w = getWidget(id);
  if (!w) throw new Error("Unknown widget: " + id);
  return w.mount(ctx);
}

/**
 * Test / advanced: clear all definitions (not for production page use).
 */function _resetRegistryForTests() {
  for (const k of Object.keys(registry)) {
    delete registry[k];
  }
}

if (typeof registerWidget !== 'undefined') __mod.registerWidget = registerWidget;
if (typeof getWidget !== 'undefined') __mod.getWidget = getWidget;
if (typeof listWidgets !== 'undefined') __mod.listWidgets = listWidgets;
if (typeof mountWidget !== 'undefined') __mod.mountWidget = mountWidget;
if (typeof _resetRegistryForTests !== 'undefined') __mod._resetRegistryForTests = _resetRegistryForTests;

};

/* ---- src/core/Launcher.js ---- */
__modules["src/core/Launcher.js"] = function (__mod, __require) {
/**
 * Orbit Launcher — panel + hotkey (default Alt+O)
 * Open/close: light opacity + translate (no heavy backdrop-filter)
 */

const STYLE_ID = "orbit-launcher-style";
const ROOT_ID = "orbit-launcher";
const ANIM_MS = 180;

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isCoarsePointer() {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) {
      return true;
    }
  } catch (e) {}
  return window.innerWidth <= 600;
}

function ensureStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
#orbit-launcher{
  position:fixed;inset:0;z-index:100000;
  display:flex;align-items:center;justify-content:center;
  font-family:system-ui,-apple-system,"Segoe UI",sans-serif;
  pointer-events:none;opacity:0;
  transition:opacity ${ANIM_MS}ms ease;
}
#orbit-launcher.is-open{
  pointer-events:auto;opacity:1;
}
#orbit-launcher .ol-backdrop{
  position:absolute;inset:0;
  background:rgba(15,23,42,.48);
  /* no backdrop-filter — main cause of open/close jank */
  opacity:0;
  transition:opacity ${ANIM_MS}ms ease;
}
#orbit-launcher.is-open .ol-backdrop{opacity:1}
#orbit-launcher .ol-panel{
  position:relative;
  width:min(360px,92vw);
  max-height:min(80vh,480px);
  overflow:auto;
  border-radius:16px;
  padding:18px 18px 14px;
  background:#f8fafc;
  color:#0f172a;
  border:1px solid rgba(15,23,42,.08);
  box-shadow:0 16px 40px rgba(15,23,42,.22);
  opacity:0;
  transform:translateY(8px);
  transition:opacity ${ANIM_MS}ms ease, transform ${ANIM_MS}ms ease;
}
#orbit-launcher.is-open .ol-panel{
  opacity:1;
  transform:translateY(0);
}
@media (prefers-color-scheme:dark){
  #orbit-launcher .ol-panel{
    background:#1e293b;
    color:#f1f5f9;
    border-color:rgba(148,163,184,.2);
  }
  #orbit-launcher .ol-backdrop{background:rgba(2,6,23,.62)}
}
@media (prefers-reduced-motion:reduce){
  #orbit-launcher,
  #orbit-launcher .ol-backdrop,
  #orbit-launcher .ol-panel,
  #orbit-launcher .ol-slider,
  #orbit-launcher .ol-slider:before{transition:none !important}
}
#orbit-launcher .ol-title{margin:0 0 4px;font-size:1.1rem;font-weight:700}
#orbit-launcher .ol-title:focus{outline:none}
#orbit-launcher .ol-title:focus-visible{outline:2px solid #38bdf8;outline-offset:2px}
#orbit-launcher .ol-panel:focus{outline:none}

#orbit-launcher .ol-sub{margin:0 0 14px;font-size:12px;opacity:.65}
#orbit-launcher .ol-row{
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:10px 6px;border-top:1px solid rgba(148,163,184,.25);
  border-radius:8px;margin:0 -6px;
}
#orbit-launcher .ol-row:first-of-type{border-top:none}
#orbit-launcher .ol-name{font-size:14px;font-weight:600}
#orbit-launcher .ol-id{font-size:11px;opacity:.55;font-weight:400}
#orbit-launcher .ol-switch{position:relative;width:48px;height:28px;flex-shrink:0}
#orbit-launcher .ol-switch input{opacity:0;width:0;height:0;position:absolute}
#orbit-launcher .ol-slider{
  position:absolute;cursor:pointer;inset:0;
  background:#cbd5e1;border-radius:999px;
  transition:background .2s ease;
}
#orbit-launcher .ol-slider:before{
  position:absolute;content:"";
  height:22px;width:22px;left:3px;bottom:3px;
  background:#fff;border-radius:50%;
  transition:transform .2s ease;
  box-shadow:0 1px 4px rgba(0,0,0,.2);
}
#orbit-launcher .ol-switch input:checked+.ol-slider{background:#38bdf8}
#orbit-launcher .ol-switch input:checked+.ol-slider:before{transform:translateX(20px)}
#orbit-launcher .ol-switch input:focus-visible+.ol-slider{
  outline:2px solid #38bdf8;outline-offset:2px;
}
#orbit-launcher .ol-foot{
  margin-top:12px;font-size:12px;opacity:.55;
  display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;
}
#orbit-launcher .ol-kbd{
  font-family:ui-monospace,monospace;font-size:11px;
  padding:1px 6px;border-radius:4px;background:rgba(148,163,184,.2);
}
#orbit-launcher .ol-empty{font-size:13px;opacity:.7;padding:8px 0}
`;
  document.head.appendChild(s);
}

/**
 * @param {object} orbitApi
 * @param {() => string} getLauncherKey
 */function createLauncher(orbitApi, getLauncherKey) {
  let open = false;
  let root = null;
  let listEl = null;
  let bound = false;
  let closeTimer = null;
  /** @type {HTMLElement | null} */
  let lastTrigger = null;

  function formatKey(key) {
    return key || "Alt+O";
  }

  function ensureDom() {
    ensureStyles();
    if (root && document.body.contains(root)) return root;
    root = document.getElementById(ROOT_ID);
    if (!root) {
      root = document.createElement("div");
      root.id = ROOT_ID;
      root.setAttribute("role", "dialog");
      root.setAttribute("aria-modal", "true");
      root.setAttribute("aria-label", "Orbit 组件管理");
      root.setAttribute("aria-hidden", "true");
      root.style.display = "none";
      root.innerHTML =
        '<div class="ol-backdrop" data-ol-close="1"></div>' +
        '<div class="ol-panel" role="document">' +
        '<h2 class="ol-title" tabindex="-1">Orbit 组件</h2>' +
        '<p class="ol-sub">开关各悬浮 Widget 的显示</p>' +
        '<div class="ol-list"></div>' +
        '<div class="ol-foot" data-ol-foot></div>' +
        "</div>";
      document.body.appendChild(root);
      root.addEventListener("click", function (e) {
        const t = e.target;
        if (t && t.getAttribute && t.getAttribute("data-ol-close")) {
          setOpen(false);
        }
      });
    }
    listEl = root.querySelector(".ol-list");
    return root;
  }

  function renderList() {
    ensureDom();
    const key = formatKey(getLauncherKey());
    const foot = root.querySelector("[data-ol-foot]");
    if (foot) {
      if (isCoarsePointer()) {
        foot.innerHTML =
          "<span>长按悬浮球可再次打开</span><span>点遮罩关闭</span>";
      } else {
        foot.innerHTML =
          '<span>快捷键 <span class="ol-kbd">' +
          key +
          "</span></span><span>Esc 关闭</span>";
      }
    }

    // Prefer listLauncherIds (respects ORBIT.widgets) over listHosts (all registered).
    const hosts =
      typeof orbitApi.listLauncherIds === "function"
        ? orbitApi.listLauncherIds()
        : orbitApi.listHosts();
    const state = {};
    orbitApi.list().forEach(function (row) {
      state[row.id] = row.visible;
    });

    if (!hosts.length) {
      listEl.innerHTML = '<div class="ol-empty">当前没有已加载的 Widget</div>';
      return;
    }

    listEl.innerHTML = hosts
      .map(function (id) {
        // Honest state: only a mounted + visible instance counts as "on".
        // Listed-but-not-yet-started (e.g. visible:false) shows as OFF;
        // toggling it on mounts it.
        const on = state[id] === true;
        // M2: labels come from Contract / adapter metadata — never hardcoded.
        const label =
          typeof orbitApi.getLabel === "function"
            ? orbitApi.getLabel(id)
            : id;
        return (
          '<div class="ol-row" data-id="' +
          escapeHtml(id) +
          '">' +
          '<div><div class="ol-name">' +
          escapeHtml(label) +
          '</div><div class="ol-id">' +
          escapeHtml(id) +
          "</div></div>" +
          '<label class="ol-switch" title="显示 / 隐藏">' +
          '<input type="checkbox" data-ol-toggle="' +
          escapeHtml(id) +
          '"' +
          (on ? " checked" : "") +
          " />" +
          '<span class="ol-slider"></span>' +
          "</label></div>"
        );
      })
      .join("");

    listEl.querySelectorAll("[data-ol-toggle]").forEach(function (input) {
      input.addEventListener("change", function () {
        const id = input.getAttribute("data-ol-toggle");
        orbitApi.setVisible(id, !!input.checked);
      });
    });
  }

  function getFocusables() {
    if (!root) return [];
    const panel = root.querySelector(".ol-panel");
    if (!panel) return [];
    const sel =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    return Array.prototype.slice.call(panel.querySelectorAll(sel)).filter(
      function (el) {
        return !el.disabled && el.offsetParent !== null;
      }
    );
  }

  function focusOnOpen() {
    const title = root && root.querySelector(".ol-title");
    if (title && typeof title.focus === "function") {
      try {
        title.focus();
        return;
      } catch (e) {}
    }
    const list = getFocusables();
    if (list.length) {
      try {
        list[0].focus();
      } catch (e) {}
    }
  }

  function restoreFocus() {
    const t = lastTrigger;
    lastTrigger = null;
    if (t && typeof t.focus === "function" && document.contains(t)) {
      try {
        t.focus();
        return;
      } catch (e) {}
    }
    if (document.body && document.body.focus) {
      try {
        document.body.focus();
      } catch (e) {}
    }
  }

  /**
   * @param {boolean} next
   * @param {HTMLElement | Event | null} [trigger]
   */
  function setOpen(next, trigger) {
    next = !!next;
    ensureDom();
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }

    if (next === open && next) {
      renderList();
      return open;
    }

    if (next) {
      if (trigger && trigger.nodeType === 1) lastTrigger = trigger;
      else if (
        typeof document !== "undefined" &&
        document.activeElement &&
        document.activeElement !== document.body
      ) {
        lastTrigger = document.activeElement;
      }
      open = true;
      root.style.display = "flex";
      root.setAttribute("aria-hidden", "false");
      renderList();
      requestAnimationFrame(function () {
        root.classList.add("is-open");
        focusOnOpen();
      });
    } else {
      open = false;
      root.classList.remove("is-open");
      root.setAttribute("aria-hidden", "true");
      closeTimer = setTimeout(function () {
        if (!open && root) root.style.display = "none";
        closeTimer = null;
        restoreFocus();
      }, ANIM_MS + 20);
    }
    return open;
  }

  function toggle(trigger) {
    return setOpen(!open, trigger);
  }

  function isOpen() {
    return open;
  }

  function matchHotkey(e, keySpec) {
    const spec = (keySpec || "Alt+O").toLowerCase().replace(/\s+/g, "");
    const parts = spec.split("+");
    const needAlt = parts.indexOf("alt") >= 0;
    const needCtrl = parts.indexOf("ctrl") >= 0 || parts.indexOf("control") >= 0;
    const needShift = parts.indexOf("shift") >= 0;
    const needMeta = parts.indexOf("meta") >= 0 || parts.indexOf("cmd") >= 0;
    const keyPart = parts[parts.length - 1];
    if (!!e.altKey !== needAlt) return false;
    if (!!e.ctrlKey !== needCtrl) return false;
    if (!!e.shiftKey !== needShift) return false;
    if (!!e.metaKey !== needMeta) return false;
    const k = (e.key || "").toLowerCase();
    if (keyPart === "o") return k === "o";
    return k === keyPart;
  }

  function onKeyDown(e) {
    if (open && e.key === "Tab") {
      const list = getFocusables();
      if (list.length) {
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
          return;
        }
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
          return;
        }
      }
    }
    if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (matchHotkey(e, getLauncherKey())) {
      e.preventDefault();
      toggle();
    }
  }

  function bind() {
    if (bound || typeof document === "undefined") return;
    bound = true;
    document.addEventListener("keydown", onKeyDown, true);
  }

  function unbind() {
    if (!bound) return;
    document.removeEventListener("keydown", onKeyDown, true);
    bound = false;
  }

  return {
    toggle: toggle,
    setOpen: setOpen,
    isOpen: isOpen,
    renderList: renderList,
    bind: bind,
    unbind: unbind,
  };
}

if (typeof createLauncher !== 'undefined') __mod.createLauncher = createLauncher;

};

/* ---- src/core/LauncherHint.js ---- */
__modules["src/core/LauncherHint.js"] = function (__mod, __require) {
/**
 * Orbit Phase C — one-time launcher hotkey hint when ≥2 widgets.
 */

const STYLE_ID = "orbit-launcher-hint-style";
const STORAGE_KEY = "orbit-launcher-hint-v1";
const HINT_ID = "orbit-launcher-hint";
const SHOW_MS = 5200;

function ensureStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
#orbit-launcher-hint{
  position:fixed;z-index:100001;
  right:16px;bottom:16px;
  max-width:min(320px,calc(100vw - 32px));
  padding:12px 14px;
  border-radius:12px;
  font-family:system-ui,-apple-system,"Segoe UI",sans-serif;
  font-size:13px;line-height:1.45;
  color:#0f172a;
  background:#f8fafc;
  border:1px solid rgba(15,23,42,.1);
  box-shadow:0 12px 32px rgba(15,23,42,.18);
  opacity:0;transform:translateY(8px);
  transition:opacity .2s ease,transform .2s ease;
  pointer-events:auto;
}
#orbit-launcher-hint.is-show{
  opacity:1;transform:translateY(0);
}
@media (prefers-color-scheme:dark){
  #orbit-launcher-hint{
    color:#f1f5f9;background:#1e293b;
    border-color:rgba(148,163,184,.25);
  }
}
#orbit-launcher-hint .olh-row{display:flex;gap:10px;align-items:flex-start}
#orbit-launcher-hint .olh-text{flex:1;min-width:0}
#orbit-launcher-hint .olh-title{font-weight:700;margin:0 0 4px;font-size:13px}
#orbit-launcher-hint .olh-body{margin:0;opacity:.8;font-size:12px}
#orbit-launcher-hint .olh-kbd{
  display:inline-block;font-family:ui-monospace,monospace;
  font-size:11px;padding:1px 6px;border-radius:4px;
  background:rgba(148,163,184,.25);
}
#orbit-launcher-hint .olh-close{
  flex-shrink:0;border:0;background:transparent;cursor:pointer;
  font-size:16px;line-height:1;opacity:.5;padding:0 2px;color:inherit;
}
#orbit-launcher-hint .olh-close:hover{opacity:.9}
@media (prefers-reduced-motion:reduce){
  #orbit-launcher-hint{transition:none}
}
`;
  document.head.appendChild(s);
}

function storageGet() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch (e) {
    return false;
  }
}

function storageSet() {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch (e) {}
}

/**
 * @param {object} opts
 * @param {() => string} opts.getLauncherKey
 * @param {() => number} opts.getWidgetCount — registered hosts or visible instances
 * @param {boolean} opts.enabled
 */function maybeShowLauncherHint(opts) {
  if (typeof document === "undefined") return;
  if (!opts || opts.enabled === false) return;
  if (storageGet()) return;
  const n = typeof opts.getWidgetCount === "function" ? opts.getWidgetCount() : 0;
  if (n < 2) return;

  ensureStyles();
  if (document.getElementById(HINT_ID)) return;

  const key = (opts.getLauncherKey && opts.getLauncherKey()) || "Alt+O";
  const coarse =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(pointer: coarse)").matches;
  const el = document.createElement("div");
  el.id = HINT_ID;
  el.setAttribute("role", "status");
  const body = coarse
    ? "在手机上<strong>长按</strong>任意悬浮球（不要滑动）可打开管理面板，开关各组件。本提示只显示一次。"
    : "按 <span class=\"olh-kbd\"></span> 可打开面板；手机可长按悬浮球。本提示只显示一次。";
  el.innerHTML =
    '<div class="olh-row">' +
    '<div class="olh-text">' +
    '<p class="olh-title">Orbit 组件管理</p>' +
    '<p class="olh-body">' + body + "</p>" +
    "</div>" +
    '<button type="button" class="olh-close" aria-label="关闭">×</button>' +
    "</div>";
  const kbd = el.querySelector(".olh-kbd");
  if (kbd) kbd.textContent = key;

  function dismiss() {
    storageSet();
    el.classList.remove("is-show");
    window.setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 200);
  }

  el.querySelector(".olh-close").addEventListener("click", dismiss);
  document.body.appendChild(el);
  requestAnimationFrame(function () {
    el.classList.add("is-show");
  });
  window.setTimeout(dismiss, SHOW_MS);
}function resetLauncherHintForDebug() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {}
}

if (typeof maybeShowLauncherHint !== 'undefined') __mod.maybeShowLauncherHint = maybeShowLauncherHint;
if (typeof resetLauncherHintForDebug !== 'undefined') __mod.resetLauncherHintForDebug = resetLauncherHintForDebug;

};

/* ---- src/core/LauncherFallback.js ---- */
__modules["src/core/LauncherFallback.js"] = function (__mod, __require) {
/**
 * Orbit Phase 5 — mobile zero-visible fallback entry (ghost)
 * Not a Widget: no drag, not in Launcher list, no position storage.
 */

const STYLE_ID = "orbit-fallback-style";
const BTN_ID = "orbit-launcher-fallback";

function ensureStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
#${BTN_ID}{
  position:fixed;
  right:max(12px, env(safe-area-inset-right));
  bottom:max(12px, env(safe-area-inset-bottom));
  z-index:99990;
  width:48px;height:48px;min-width:44px;min-height:44px;
  border:none;border-radius:999px;
  padding:0;margin:0;
  cursor:pointer;
  background:rgba(15,23,42,.72);
  color:#f8fafc;
  font-size:18px;line-height:1;
  box-shadow:0 4px 16px rgba(0,0,0,.25);
  display:flex;
  align-items:center;justify-content:center;
  -webkit-tap-highlight-color:transparent;
  opacity:0;
  visibility:hidden;
  pointer-events:none;
  transform:scale(0.85);
  transition:opacity .22s ease, transform .22s ease, visibility .22s ease;
}
#${BTN_ID}.is-visible{
  opacity:1;
  visibility:visible;
  pointer-events:auto;
  transform:scale(1);
}
#${BTN_ID}:focus-visible{
  outline:2px solid #38bdf8;outline-offset:3px;
}
@media (prefers-color-scheme:light){
  #${BTN_ID}{background:rgba(15,23,42,.82)}
}
`;
  document.head.appendChild(s);
}

function isCoarsePointer() {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) {
      return true;
    }
  } catch (e) {}
  return window.innerWidth <= 600;
}

/**
 * @param {object} orbitApi
 * @param {() => string} getMode — 'ghost' | 'host-button' | 'none'
 */function createLauncherFallback(orbitApi, getMode) {
  let btn = null;

  function visibleWidgetCount() {
    const rows = orbitApi.list() || [];
    let n = 0;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].visible) n += 1;
    }
    return n;
  }

  function ensureBtn() {
    ensureStyles();
    if (btn && document.body.contains(btn)) return btn;
    btn = document.getElementById(BTN_ID);
    if (!btn) {
      btn = document.createElement("button");
      btn.id = BTN_ID;
      btn.type = "button";
      btn.setAttribute("aria-label", "管理 Orbit 组件");
      btn.title = "管理 Orbit 组件";
      btn.textContent = "◎";
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (orbitApi.openLauncher) {
          orbitApi.openLauncher(btn);
        } else if (orbitApi.toggleLauncher) {
          orbitApi.toggleLauncher();
        }
      });
      document.body.appendChild(btn);
    }
    return btn;
  }

  function sync() {
    const mode = (getMode && getMode()) || "ghost";
    if (mode === "none" || mode === "host-button") {
      if (btn) btn.classList.remove("is-visible");
      return;
    }
    // ghost: only coarse + zero visible widgets
    const show = isCoarsePointer() && visibleWidgetCount() === 0;
    const el = ensureBtn();
    if (show) el.classList.add("is-visible");
    else el.classList.remove("is-visible");
  }

  return { sync: sync, ensureBtn: ensureBtn };
}

if (typeof createLauncherFallback !== 'undefined') __mod.createLauncherFallback = createLauncherFallback;

};

/* ---- src/core/LifecycleScope.js ---- */
__modules["src/core/LifecycleScope.js"] = function (__mod, __require) {
/**
 * Orbit v0.3 — LifecycleScope
 *
 * Per-instance cleanup bag. Register external side effects with add(fn);
 * dispose() runs them in reverse order, idempotently.
 * One failing cleanup must not block the rest.
 */

/**
 * @returns {{
 *   add: (fn: () => void | Promise<void>) => () => void,
 *   dispose: (emitError?: (err: unknown) => void) => Promise<void>,
 *   disposed: boolean
 * }}
 */function createLifecycleScope() {
  let disposed = false;
  /** @type {Set<() => void | Promise<void>>} */
  const cleanups = new Set();

  /**
   * @param {() => void | Promise<void>} fn
   * @returns {() => void} unregister (no-op if already disposed)
   */
  function add(fn) {
    if (typeof fn !== "function") {
      throw new Error("LifecycleScope.add requires a function");
    }
    if (disposed) {
      Promise.resolve()
        .then(fn)
        .catch(function () {});
      return function () {};
    }
    cleanups.add(fn);
    return function remove() {
      cleanups.delete(fn);
    };
  }

  /**
   * @param {(err: unknown) => void} [emitError]
   */
  async function dispose(emitError) {
    if (disposed) return;
    disposed = true;
    const list = Array.from(cleanups).reverse();
    cleanups.clear();
    for (let i = 0; i < list.length; i++) {
      try {
        await list[i]();
      } catch (error) {
        if (typeof emitError === "function") {
          try {
            emitError(error);
          } catch (_) {}
        }
      }
    }
  }

  return {
    add: add,
    dispose: dispose,
    get disposed() {
      return disposed;
    },
  };
}

if (typeof createLifecycleScope !== 'undefined') __mod.createLifecycleScope = createLifecycleScope;

};

/* ---- src/core/version.js ---- */
__modules["src/core/version.js"] = function (__mod, __require) {
/**
 * Orbit — version (single source of truth)
 *
 * This is the ONLY place the runtime version string is authored.
 * scripts/check-version.mjs enforces that it matches package.json
 * "version" and that dist/orbit.js + key docs carry the same number.
 */
const VERSION = "0.4.0";

if (typeof VERSION !== 'undefined') __mod.VERSION = VERSION;

};

/* ---- src/core/Orbit.js ---- */
__modules["src/core/Orbit.js"] = function (__mod, __require) {
var __dep0 = __require("src/core/WidgetRegistry.js");
var registerWidget = __dep0.registerWidget;
var getWidget = __dep0.getWidget;
var listWidgets = __dep0.listWidgets;
var mountWidget = __dep0.mountWidget;
var __dep1 = __require("src/core/Launcher.js");
var createLauncher = __dep1.createLauncher;
var __dep2 = __require("src/core/LauncherHint.js");
var maybeShowLauncherHint = __dep2.maybeShowLauncherHint;
var __dep3 = __require("src/core/LauncherFallback.js");
var createLauncherFallback = __dep3.createLauncherFallback;
var __dep4 = __require("src/core/LifecycleScope.js");
var createLifecycleScope = __dep4.createLifecycleScope;
var __dep5 = __require("src/core/version.js");
var VERSION = __dep5.VERSION;
/**
 * Orbit Runtime — Phase 4 API surface
 *
 * Public: mount, register, list, get, setVisible, destroy,
 *         open/close/toggleLauncher, on/off, registerHost (legacy)
 *
 * Semantics:
 * - setVisible(false) = hide (keep instance/resources)
 * - destroy(id) = explicit teardown
 * - ORBIT.widgets omitting an already-mounted id does NOT destroy it
 */
/** @type {object | null} */
let mountedConfig = null;
/** @type {boolean} */
let mounted = false;
/** @type {boolean} */
let launcherBound = false;

/**
 * Legacy + v0.3 host adapter
 * @typedef {Object} HostAdapter
 * @property {() => void} start
 * @property {() => HTMLElement | null} getRoot
 * @property {() => void} [destroy]
 * @property {() => HTMLElement[]} [getVisibilityTargets]
 * @property {(visible: boolean) => void} [setVisible]
 */

/** @type {Map<string, HostAdapter>} */
const hostAdapters = new Map();

/**
 * @typedef {Object} InstanceRecord
 * @property {string} id
 * @property {boolean} visible
 * @property {boolean} started
 * @property {boolean} destroyed
 */

/** @type {Map<string, InstanceRecord>} */
const instances = new Map();

/** @type {Map<string, Set<Function>>} */
const listeners = new Map();

/**
 * Per-widget visibility persistence (local-first, M3 requirement).
 * User toggle state (Launcher switch, notice close) survives reloads and
 * wins over ORBIT.widgets defaults. Destroy clears the preference so a
 * config-driven remount restores the default. Opt out with
 * ORBIT.persistVisibility: false.
 */
const VIS_STORAGE_KEY = "orbit-visible-v1";

function readVisiblePrefs() {
  try {
    const raw = localStorage.getItem(VIS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveVisiblePref(id, visible) {
  try {
    const prefs = readVisiblePrefs();
    prefs[id] = !!visible;
    localStorage.setItem(VIS_STORAGE_KEY, JSON.stringify(prefs));
  } catch (e) {}
}

function persistVisibilityEnabled() {
  const cfg = mountedConfig || readPageConfig();
  return !cfg || cfg.persistVisibility !== false;
}

/** @type {ReturnType<typeof createLauncher> | null} */
let launcher = null;
/** @type {ReturnType<typeof createLauncherFallback> | null} */
let fallback = null;

const api = {
  version: VERSION,
  mount: mount,
  register: register,
  list: list,
  get: get,
  listRegistered: listRegistered,
  listHosts: listHosts,
  listLauncherIds: listLauncherIds,
  getLabel: getLabel,
  registerHost: registerHost,
  setVisible: setVisible,
  destroy: destroy,
  toggleLauncher: toggleLauncher,
  openLauncher: openLauncher,
  closeLauncher: closeLauncher,
  on: on,
  off: off,
  exportProfile: exportProfile,
  importProfile: importProfile,
  registry: null,
  isMounted: function () {
    return mounted;
  },
  getConfig: function () {
    return mountedConfig ? Object.assign({}, mountedConfig) : null;
  },
  getLauncherKey: getLauncherKey,
};

const Orbit = api;

function emit(event, payload) {
  const set = listeners.get(event);
  if (!set) return;
  set.forEach(function (fn) {
    try {
      fn(payload);
    } catch (e) {
      console.error("[Orbit] listener error", event, e);
    }
  });
}

function readPageConfig() {
  if (typeof window === "undefined") return {};
  const o = window.ORBIT;
  return o && typeof o === "object" ? o : {};
}

function getLauncherKey() {
  const cfg = mountedConfig || readPageConfig();
  return (cfg && cfg.launcherKey) || "Alt+O";
}

function getLauncherFallbackMode() {
  const cfg = mountedConfig || readPageConfig();
  const m = cfg && cfg.launcherFallback;
  if (m === "none" || m === "host-button" || m === "ghost") return m;
  return "ghost";
}

function ensureLauncher() {
  if (!launcher) {
    launcher = createLauncher(api, getLauncherKey);
  }
  return launcher;
}

function ensureFallback() {
  if (!fallback) {
    fallback = createLauncherFallback(api, getLauncherFallbackMode);
  }
  return fallback;
}

function syncFallback() {
  try {
    ensureFallback().sync();
  } catch (e) {}
}

/**
 * Legacy adapter registration (v0.2 compatible).
 * @param {string} id
 * @param {HostAdapter} adapter
 */
function registerHost(id, adapter) {
  if (!id || !adapter || typeof adapter.start !== "function") {
    throw new Error("registerHost requires id and start()");
  }
  hostAdapters.set(id, {
    label: adapter.label,
    defaultVisible: adapter.defaultVisible !== false,
    start: adapter.start,
    getRoot:
      typeof adapter.getRoot === "function"
        ? adapter.getRoot
        : function () {
            return null;
          },
    destroy: typeof adapter.destroy === "function" ? adapter.destroy : null,
    getVisibilityTargets:
      typeof adapter.getVisibilityTargets === "function"
        ? adapter.getVisibilityTargets
        : null,
    setVisible:
      typeof adapter.setVisible === "function" ? adapter.setVisible : null,
  });
  return api;
}

/**
 * Widget v1 definition register (Contract Alpha, M2).
 * Registers the definition AND bridges it onto the proven HostAdapter
 * instance path (start / getRoot / destroy / visibility / launcher),
 * so a Contract widget gets the same Runtime management as first-party hosts.
 * @param {object} definition
 */
function register(definition) {
  if (!definition || !definition.id) {
    throw new Error("register requires definition.id");
  }
  registerWidget(definition.id, definition);
  if (!hostAdapters.has(definition.id)) {
    hostAdapters.set(definition.id, createContractAdapter(definition));
  }
  return api;
}

// =========================================================================
// Contract Alpha — Runtime services (M2)
// ctx = { lifecycle, visibility, profile, portal, launcher }
// =========================================================================

function createContractCtx(id, definition) {
  const scope = createLifecycleScope();

  /** @type {HTMLElement[]} */
  let portals = [];

  const services = {
    /** Per-instance cleanup bag; dispose() is idempotent. */
    lifecycle: scope,

    /** Single-element show/hide with aria coordination. */
    visibility: {
      setVisible: function (el, visible) {
        setElementVisible(el, !!visible);
      },
    },

    /** Per-widget-id namespaced local persistence (JSON only). */
    profile: {
      get: function () {
        try {
          const raw = localStorage.getItem("orbit-profile:" + id);
          return raw ? JSON.parse(raw) : null;
        } catch (e) {
          return null;
        }
      },
      set: function (obj) {
        try {
          localStorage.setItem("orbit-profile:" + id, JSON.stringify(obj));
        } catch (e) {}
      },
      clear: function () {
        try {
          localStorage.removeItem("orbit-profile:" + id);
        } catch (e) {}
      },
    },

    /** body-level sheet/menu ownership; Runtime hides + removes on destroy. */
    portal: {
      claim: function (el) {
        if (el && portals.indexOf(el) < 0) portals.push(el);
      },
      release: function (el) {
        const i = portals.indexOf(el);
        if (i >= 0) portals.splice(i, 1);
      },
      list: function () {
        return portals.slice();
      },
    },

    /** Launcher access for the widget. */
    launcher: {
      open: openLauncher,
      close: closeLauncher,
      toggle: toggleLauncher,
    },

    /**
     * Runtime-managed instance control (M3 requirement): lets a widget
     * synchronize its OWN runtime state (e.g. a notice close button) with
     * the Launcher switch and the persisted visibility preference.
     */
    instance: {
      setVisible: function (visible) {
        setVisible(definition.id, !!visible);
      },
      destroy: function () {
        destroy(definition.id);
      },
    },
  };

  return { ctx: services, portals: portals };
}

/**
 * Wrap a Contract definition as a HostAdapter.
 * @param {object} definition
 */
function createContractAdapter(definition) {
  let instance = null;
  let ctxCtl = null;

  const adapter = {
    label: definition.label,
    defaultVisible: definition.defaultVisible !== false,
    start: function () {
      if (instance) return true;
      try {
        ctxCtl = createContractCtx(definition.id, definition);
        const mounted = definition.mount(ctxCtl.ctx);
        if (!mounted || typeof mounted.destroy !== "function") {
          throw new Error(
            "Contract widget " + definition.id + " mount() must return a WidgetInstance with destroy()"
          );
        }
        instance = mounted;
        // delegate visibility only when the widget implements setVisible;
        // otherwise applyDomVisibility falls through to generic DOM handling
        if (typeof instance.setVisible === "function") {
          adapter.setVisible = function (visible) {
            instance.setVisible(!!visible);
          };
        } else {
          delete adapter.setVisible;
        }
        return true;
      } catch (e) {
        emit("widgetError", { id: definition.id, phase: "mount", error: e });
        console.error("[Orbit] contract mount failed", definition.id, e);
        instance = null;
        return false;
      }
    },
    getRoot: function () {
      return (instance && instance.root) || null;
    },
    getVisibilityTargets: function () {
      const targets = [];
      if (instance && instance.root) targets.push(instance.root);
      // M3: WidgetInstance.portals() lets hosts (e.g. Music dock sheet)
      // report body-level nodes without touching Runtime internals.
      if (instance && typeof instance.portals === "function") {
        try {
          const extra = instance.portals() || [];
          for (let i = 0; i < extra.length; i++) {
            if (extra[i] && targets.indexOf(extra[i]) < 0) targets.push(extra[i]);
          }
        } catch (e) {}
      }
      if (ctxCtl) {
        for (let i = 0; i < ctxCtl.portals.length; i++) {
          if (ctxCtl.portals[i] && targets.indexOf(ctxCtl.portals[i]) < 0) {
            targets.push(ctxCtl.portals[i]);
          }
        }
      }
      return targets;
    },
    destroy: function () {
      if (instance) {
        try {
          if (typeof instance.destroy === "function") instance.destroy();
        } catch (e) {
          emit("widgetError", { id: definition.id, phase: "destroy", error: e });
          console.error("[Orbit] contract destroy failed", definition.id, e);
        }
        // M2: Runtime owns teardown of the instance boundary
        if (instance.root && instance.root.parentNode) {
          try { instance.root.parentNode.removeChild(instance.root); } catch (e) {}
        }
        instance = null;
      }
      if (ctxCtl) {
        try {
          ctxCtl.ctx.lifecycle.dispose();
        } catch (e) {}
        // remove claimed portals (M2: Runtime owns portal teardown)
        for (let i = 0; i < ctxCtl.portals.length; i++) {
          const el = ctxCtl.portals[i];
          try {
            if (el && el.parentNode) el.parentNode.removeChild(el);
          } catch (e) {}
        }
        ctxCtl.portals.length = 0;
        ctxCtl = null;
      }
    },
  };

  return adapter;
}

function getOrCreateInstance(id) {
  let inst = instances.get(id);
  if (!inst) {
    inst = { id: id, visible: false, started: false, destroyed: false };
    instances.set(id, inst);
  }
  return inst;
}

/**
 * Single-element visibility primitive (M2): shared by the host-adapter path
 * (applyDomVisibility) and the Contract ctx.visibility service.
 */
function setElementVisible(el, visible) {
  if (!el) return;
  if (visible) {
    if (el._orbitHideTimer) {
      clearTimeout(el._orbitHideTimer);
      el._orbitHideTimer = null;
    }
    if (el.classList) {
      el.classList.remove("orbit-hidden", "orbit-hidden-final", "orbit-hiding");
    }
    el.style.display = "";
    el.style.visibility = "";
    el.style.opacity = "";
    el.removeAttribute("hidden");
    el.setAttribute("aria-hidden", "false");
    // force reflow then allow transition from hidden state if needed
    void el.offsetWidth;
  } else {
    el.setAttribute("aria-hidden", "true");
    if (el.classList) {
      el.classList.remove("orbit-hidden-final");
      el.classList.add("orbit-hidden");
    }
    if (el._orbitHideTimer) clearTimeout(el._orbitHideTimer);
    el._orbitHideTimer = setTimeout(function () {
      el._orbitHideTimer = null;
      if (el.classList && el.classList.contains("orbit-hidden")) {
        el.classList.add("orbit-hidden-final");
      }
    }, 240);
  }
}

/**
 * Apply hide/show to root + optional visibility targets from adapter.
 * No per-widget id hardcoding in Runtime.
 */
function applyDomVisibility(id, visible) {
  const adapter = hostAdapters.get(id);
  if (!adapter) return false;

  if (typeof adapter.setVisible === "function") {
    try {
      adapter.setVisible(visible);
      return true;
    } catch (e) {
      console.error("[Orbit] adapter.setVisible", id, e);
    }
  }

  /** @type {HTMLElement[]} */
  const targets = [];
  const root = adapter.getRoot && adapter.getRoot();
  if (root) targets.push(root);
  if (typeof adapter.getVisibilityTargets === "function") {
    try {
      const extra = adapter.getVisibilityTargets() || [];
      for (let i = 0; i < extra.length; i++) {
        if (extra[i] && targets.indexOf(extra[i]) < 0) targets.push(extra[i]);
      }
    } catch (e) {}
  }
  if (!targets.length) return false;

  for (let i = 0; i < targets.length; i++) {
    setElementVisible(targets[i], visible);
  }
  return true;
}

function ensureStarted(id) {
  const adapter = hostAdapters.get(id);
  if (!adapter) {
    console.warn("[Orbit] no host registered for", id);
    return false;
  }
  const inst = getOrCreateInstance(id);
  if (inst.destroyed) {
    inst.destroyed = false;
    inst.started = false;
  }
  if (!inst.started) {
    // M4 fix: only mark started when the adapter actually mounted.
    // Contract adapters return false on mount() throw, so a failed mount
    // stays "not started" (Launcher OFF, next setVisible retries).
    const ok = adapter.start() !== false;
    if (ok) {
      inst.started = true;
    } else {
      inst.visible = false;
    }
  }
  return inst.started;
}

function setVisible(id, visible) {
  if (!id) return api;
  visible = !!visible;
  const inst = getOrCreateInstance(id);

  if (visible) {
    const started = ensureStarted(id);
    inst.visible = started;
    if (started) {
      var tries = 0;
      function paint() {
        const ok = applyDomVisibility(id, true);
        if (!ok && tries < 20) {
          tries += 1;
          setTimeout(paint, 50);
        }
      }
      paint();
    }
  } else {
    inst.visible = false;
    if (inst.started) {
      applyDomVisibility(id, false);
    }
  }

  if (persistVisibilityEnabled()) {
    saveVisiblePref(id, visible);
  }
  emit("visibilityChange", { id: id, visible: visible });
  if (launcher && launcher.isOpen()) {
    launcher.renderList();
  }
  syncFallback();
  return api;
}

/**
 * Explicit destroy. Not implied by omitting id from widgets config.
 * options.forget: also clear the persisted visibility preference so the
 * next mount falls back to the ORBIT.widgets default.
 * @param {string} id
 * @param {{ forget?: boolean }} [options]
 */
function destroy(id, options) {
  if (!id) return api;
  const adapter = hostAdapters.get(id);
  const inst = instances.get(id);

  if (adapter && typeof adapter.destroy === "function") {
    try {
      adapter.destroy();
    } catch (e) {
      emit("widgetError", { id: id, phase: "destroy", error: e });
      console.error("[Orbit] destroy failed", id, e);
    }
  } else if (adapter && adapter.getRoot) {
    const root = adapter.getRoot();
    if (root && root.parentNode) {
      try {
        root.parentNode.removeChild(root);
      } catch (e) {}
    }
  }

  if (inst) {
    inst.started = false;
    inst.visible = false;
    inst.destroyed = true;
  }

  // M4 fix: options.forget clears the persisted visibility preference
  // (default: keep it — destroy is a program action, not a user preference).
  if (options && options.forget) {
    try {
      const prefs = readVisiblePrefs();
      if (id in prefs) {
        delete prefs[id];
        localStorage.setItem(VIS_STORAGE_KEY, JSON.stringify(prefs));
      }
    } catch (e) {}
  }

  emit("destroy", { id: id, options: options || {} });
  if (launcher && launcher.isOpen()) {
    launcher.renderList();
  }
  syncFallback();
  return api;
}

function get(id) {
  if (!id) return null;
  const inst = instances.get(id);
  if (!inst) return null;
  return {
    id: inst.id,
    visible: !!inst.visible,
    started: !!inst.started,
    destroyed: !!inst.destroyed,
  };
}

function defaultWidgets() {
  const ids = [];
  hostAdapters.forEach(function (a, id) {
    // M4 fix: adapters may opt out of the default-on list (e.g. Notice) —
    // consistent with the docs ("notice must be listed in ORBIT.widgets").
    ids.push({ id: id, visible: a.defaultVisible !== false });
  });
  return ids;
}

/** @type {MutationObserver | null} */
let bodyRecoveryObserver = null;

/**
 * Runtime-level generic styles. Injected at mount() time — independent of the
 * Launcher panel ever being opened. Without these, setElementVisible()'s
 * orbit-hidden classes would have no visual effect (e.g. Notice close button).
 */
const RUNTIME_STYLE_ID = "orbit-runtime-style";
function ensureRuntimeStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(RUNTIME_STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = RUNTIME_STYLE_ID;
  s.textContent =
    "/* Orbit runtime — visibility primitives (setElementVisible) */" +
    ".orbit-hidden{" +
    "opacity:0 !important;visibility:hidden !important;pointer-events:none !important;" +
    "transition:opacity .22s ease, visibility .22s ease !important;" +
    "}" +
    ".orbit-hidden-final{display:none !important;}";
  document.head.appendChild(s);
}

/**
 * M4 — Profile Alpha (local-first, portable).
 *
 * Envelope:
 *   {
 *     "schema": "orbit-profile/0.4",
 *     "exportedAt": "<ISO>",
 *     "runtime": { "launcherKey": "Alt+O", "visibility": { "<id>": bool } },
 *     "widgets": { "<id>": <per-widget profile JSON>, "music": { state: <legacy> } }
 *   }
 *
 * Data stays in the browser; export is always user-initiated.
 */
const PROFILE_SCHEMA = "orbit-profile/0.4";
const PROFILE_PREFIX = "orbit-profile:";
const MUSIC_LEGACY_KEY = "mp-state-v3";

function collectWidgetProfiles() {
  const out = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || key.indexOf(PROFILE_PREFIX) !== 0) continue;
      const id = key.slice(PROFILE_PREFIX.length);
      try {
        const raw = localStorage.getItem(key);
        out[id] = raw ? JSON.parse(raw) : null;
      } catch (e) {
        out[id] = null; // corrupted single entry — export as null, never block
      }
    }
  } catch (e) {}
  return out;
}

function exportProfile() {
  const profile = {
    schema: PROFILE_SCHEMA,
    exportedAt: new Date().toISOString(),
    runtime: {
      launcherKey: getLauncherKey(),
      visibility: readVisiblePrefs(),
    },
    widgets: collectWidgetProfiles(),
  };
  // Music's legacy host state travels as widgets.music.state
  try {
    const raw = localStorage.getItem(MUSIC_LEGACY_KEY);
    if (raw) {
      try {
        profile.widgets.music = Object.assign(
          {},
          profile.widgets.music || {},
          { state: JSON.parse(raw) }
        );
      } catch (e) {}
    }
  } catch (e) {}
  return profile;
}

/**
 * Import a previously exported profile. Validation is strict on the
 * envelope (schema), tolerant inside it: a corrupted widget entry is
 * skipped without blocking the rest; unknown widget ids keep their data
 * (they become usable if the widget is registered later).
 * @param {object|string} input
 * @returns {{ ok: boolean, error?: string, imported?: { widgets: string[], visibility: string[] } }}
 */
function importProfile(input) {
  let profile = input;
  if (typeof profile === "string") {
    try {
      profile = JSON.parse(profile);
    } catch (e) {
      return { ok: false, error: "invalid-json" };
    }
  }
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    return { ok: false, error: "not-an-object" };
  }
  if (profile.schema !== PROFILE_SCHEMA) {
    return {
      ok: false,
      error: "unsupported-schema: " + String(profile.schema),
    };
  }

  const imported = { widgets: [], visibility: [] };

  // runtime.visibility → merge into persisted preferences (never wipe
  // prefs for ids the imported profile does not mention)
  if (
    profile.runtime &&
    typeof profile.runtime.visibility === "object" &&
    profile.runtime.visibility !== null
  ) {
    const prefs = readVisiblePrefs();
    for (const id of Object.keys(profile.runtime.visibility)) {
      const v = profile.runtime.visibility[id];
      if (typeof v === "boolean") {
        prefs[id] = v;
        imported.visibility.push(id);
      }
    }
    try {
      localStorage.setItem(VIS_STORAGE_KEY, JSON.stringify(prefs));
    } catch (e) {}
  }

  // widgets → per-widget namespaced storage; corrupted entries skipped
  if (
    profile.widgets &&
    typeof profile.widgets === "object" &&
    profile.widgets !== null
  ) {
    for (const id of Object.keys(profile.widgets)) {
      const w = profile.widgets[id];
      if (!w || typeof w !== "object" || Array.isArray(w)) {
        continue; // single-entry corruption tolerance
      }
      if (id === "music" && w.state && typeof w.state === "object") {
        // legacy host state back to its own key; the rest to profile ns
        try {
          localStorage.setItem(MUSIC_LEGACY_KEY, JSON.stringify(w.state));
        } catch (e) {}
        const rest = Object.assign({}, w);
        delete rest.state;
        if (Object.keys(rest).length) {
          try {
            localStorage.setItem(PROFILE_PREFIX + id, JSON.stringify(rest));
          } catch (e) {}
        }
      } else {
        try {
          localStorage.setItem(PROFILE_PREFIX + id, JSON.stringify(w));
        } catch (e) {}
      }
      imported.widgets.push(id);
    }
  }

  emit("profileImport", { imported: imported });
  return { ok: true, imported: imported };
}

/**
 * M3 fix — unified instance recovery for PJAX / theme body swaps.
 *
 * Some static-site themes (Hexo + PJAX etc.) replace document.body children
 * during navigation. Widget roots that live in body then disappear. Music
 * had its own pjax/observer revival; Clock and Notice (Contract widgets)
 * had none. This Runtime-level observer re-attaches ANY started, non-destroyed
 * instance root that vanished from body — no per-widget recovery code needed.
 *
 * Guards:
 *  - inst.started && !inst.destroyed  → destroy() never revives
 *  - hidden instances keep their hide state (classList travels with root)
 */
function ensureBodyRecovery() {
  if (bodyRecoveryObserver || typeof document === "undefined") return;
  bodyRecoveryObserver = new MutationObserver(function () {
    if (!document.body) return;
    hostAdapters.forEach(function (adapter, id) {
      const inst = instances.get(id);
      if (!inst || !inst.started || inst.destroyed) return;
      if (!adapter || typeof adapter.getRoot !== "function") return;
      let root = null;
      try {
        root = adapter.getRoot();
      } catch (e) {}
      if (!root) return;
      if (document.body.contains(root)) return;
      try {
        document.body.appendChild(root);
      } catch (e) {}
      if (typeof adapter.onRootRestored === "function") {
        try {
          adapter.onRootRestored();
        } catch (e) {}
      }
      // M4 fix: also re-attach claimed portals / visibility targets that
      // left the body in the same swap (e.g. Music's dock sheet).
      if (typeof adapter.getVisibilityTargets === "function") {
        try {
          const targets = adapter.getVisibilityTargets() || [];
          for (let i = 0; i < targets.length; i++) {
            const el = targets[i];
            if (el && el !== root && !document.body.contains(el)) {
              document.body.appendChild(el);
            }
          }
        } catch (e) {}
      }
    });
  });
  // Watch <html> (subtree) instead of <body>: some PJAX themes replace the
  // <body> element itself, which would silently kill a body-bound observer.
  bodyRecoveryObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

/**
 * Idempotent mount. widgets[] only updates listed ids — never destroys omitted ones.
 * @param {object} [config]
 */
function mount(config) {
  const page = readPageConfig();
  const cfg = Object.assign({}, page, config || {});

  if (!mounted) {
    mountedConfig = cfg;
    mounted = true;
  } else if (config) {
    // Merge config object but do not interpret missing widgets as teardown
    mountedConfig = Object.assign({}, mountedConfig, config);
    if (config.widgets) {
      mountedConfig.widgets = config.widgets;
    }
  }

  const widgets =
    (mountedConfig &&
      Array.isArray(mountedConfig.widgets) &&
      mountedConfig.widgets.length &&
      mountedConfig.widgets) ||
    defaultWidgets();

  // User visibility prefs (Launcher toggles / notice close) win over the
  // config defaults; missing prefs fall back to the configured value.
  const prefs = persistVisibilityEnabled() ? readVisiblePrefs() : {};
  widgets.forEach(function (w) {
    if (!w || !w.id) return;
    if (!hostAdapters.has(w.id)) return;
    const pref = prefs[w.id];
    const vis = typeof pref === "boolean" ? pref : w.visible !== false;
    setVisible(w.id, vis);
  });

  if (!launcherBound) {
    ensureLauncher().bind();
    launcherBound = true;
  }

  ensureRuntimeStyles();
  ensureBodyRecovery();

  try {
    var hintEnabled = !mountedConfig || mountedConfig.launcherHint !== false;
    maybeShowLauncherHint({
      enabled: hintEnabled,
      getLauncherKey: getLauncherKey,
      getWidgetCount: function () {
        return typeof listLauncherIds === "function" ? listLauncherIds().length : hostAdapters.size;
      },
    });
  } catch (e) {}

  syncFallback();
  emit("mount", { config: mountedConfig });
  return api;
}

function list() {
  const out = [];
  instances.forEach(function (inst) {
    if (inst.destroyed && !inst.started) return;
    out.push({ id: inst.id, visible: !!inst.visible });
  });
  return out;
}

function listRegistered() {
  return listWidgets();
}

function listHosts() {
  return Array.from(hostAdapters.keys());
}

/**
 * Ids shown in the Launcher panel.
 *
 * - If ORBIT.launcherShowAll === true → every registered host.
 * - Else if ORBIT.widgets is a non-empty array → only those ids that are
 *   registered (站长显式加载的组件), plus any extra instances already started
 *   (e.g. dynamic register + setVisible).
 * - Else (no widgets config) → all registered hosts (same as listHosts).
 *
 * This keeps the panel honest: orbit.js always registers music/clock/notice,
 * but the panel should not list Notice when the site never put it in widgets.
 */
function listLauncherIds() {
  const cfg = mountedConfig || readPageConfig();
  if (cfg && cfg.launcherShowAll === true) {
    return Array.from(hostAdapters.keys());
  }
  if (cfg && Array.isArray(cfg.widgets) && cfg.widgets.length) {
    const ids = [];
    const seen = Object.create(null);
    for (let i = 0; i < cfg.widgets.length; i++) {
      const w = cfg.widgets[i];
      if (!w || !w.id || seen[w.id]) continue;
      if (!hostAdapters.has(w.id)) continue;
      seen[w.id] = true;
      ids.push(w.id);
    }
    instances.forEach(function (inst, id) {
      if (seen[id]) return;
      if (!inst.started || inst.destroyed) return;
      if (!hostAdapters.has(id)) return;
      seen[id] = true;
      ids.push(id);
    });
    return ids;
  }
  return Array.from(hostAdapters.keys());
}

/**
 * M2: user-facing label for a host/widget — Contract metadata first,
 * then adapter label, then the raw id.
 * @param {string} id
 */
function getLabel(id) {
  const def = getWidget(id);
  if (def && def.label) return def.label;
  const adapter = hostAdapters.get(id);
  if (adapter && adapter.label) return adapter.label;
  return id;
}

function toggleLauncher(trigger) {
  const L = ensureLauncher();
  const open = L.toggle(trigger);
  emit("launcherOpen", { open: open });
  emit("launcherToggle", { open: open });
  return api;
}

function openLauncher(trigger) {
  ensureLauncher().setOpen(true, trigger);
  emit("launcherOpen", { open: true });
  emit("launcherToggle", { open: true });
  return api;
}

function closeLauncher() {
  ensureLauncher().setOpen(false);
  emit("launcherClose", { open: false });
  emit("launcherToggle", { open: false });
  return api;
}

function on(event, fn) {
  if (!event || typeof fn !== "function") return api;
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return api;
}

function off(event, fn) {
  const set = listeners.get(event);
  if (set && fn) set.delete(fn);
  return api;
}

api.registry = {
  register: registerWidget,
  get: getWidget,
  list: listWidgets,
  mountWidget: mountWidget,
};__mod.Orbit = Orbit;
__mod.mount = mount;
__mod.list = list;
__mod.get = get;
__mod.setVisible = setVisible;
__mod.destroy = destroy;
__mod.toggleLauncher = toggleLauncher;
__mod.registerHost = registerHost;
__mod.register = register;
__mod.getLabel = getLabel;
__mod.exportProfile = exportProfile;
__mod.importProfile = importProfile;
__mod.on = on;
__mod.off = off;
__mod.registerWidget = registerWidget;
__mod.getWidget = getWidget;
__mod.listWidgets = listWidgets;
__mod.mountWidget = mountWidget;
__mod.default = Orbit;

if (typeof Orbit !== 'undefined') __mod.Orbit = Orbit;
if (typeof mount !== 'undefined') __mod.mount = mount;
if (typeof list !== 'undefined') __mod.list = list;
if (typeof get !== 'undefined') __mod.get = get;
if (typeof setVisible !== 'undefined') __mod.setVisible = setVisible;
if (typeof destroy !== 'undefined') __mod.destroy = destroy;
if (typeof toggleLauncher !== 'undefined') __mod.toggleLauncher = toggleLauncher;
if (typeof registerHost !== 'undefined') __mod.registerHost = registerHost;
if (typeof register !== 'undefined') __mod.register = register;
if (typeof getLabel !== 'undefined') __mod.getLabel = getLabel;
if (typeof exportProfile !== 'undefined') __mod.exportProfile = exportProfile;
if (typeof importProfile !== 'undefined') __mod.importProfile = importProfile;
if (typeof on !== 'undefined') __mod.on = on;
if (typeof off !== 'undefined') __mod.off = off;
if (typeof registerWidget !== 'undefined') __mod.registerWidget = registerWidget;
if (typeof getWidget !== 'undefined') __mod.getWidget = getWidget;
if (typeof listWidgets !== 'undefined') __mod.listWidgets = listWidgets;
if (typeof mountWidget !== 'undefined') __mod.mountWidget = mountWidget;

};

/* ---- src/interaction/Gesture.js ---- */
__modules["src/interaction/Gesture.js"] = function (__mod, __require) {
/**
 * FWF Interaction — Gesture
 *
 * Owns: short press vs long press, click threshold, ghost-click guard.
 * Long-press + small movement → onLongPressTap (e.g. open Orbit launcher)
 * Long-press + move / move past threshold → onDragStart
 */

/**
 * @typedef {Object} GestureConfig
 * @property {number} longPressMs
 * @property {number} clickThreshold
 * @property {number} [longPressTapMax] max movement to still count as long-press tap
 */

/**
 * @typedef {Object} GestureHandlers
 * @property {() => void} [onToggle]
 * @property {(e: PointerEvent) => void} [onDragStart]
 * @property {(e: PointerEvent) => void} [onLongPressTap]
 * @property {() => boolean} [isBlocked]
 */

/**
 * @param {GestureConfig} config
 * @param {GestureHandlers} handlers
 */function createGesture(config, handlers) {
  const longPressMs = config.longPressMs != null ? config.longPressMs : 550;
  const clickThreshold = config.clickThreshold != null ? config.clickThreshold : 8;
  const longPressTapMax =
    config.longPressTapMax != null ? config.longPressTapMax : 20;

  let longPressTimer = null;
  let activePointer = null;
  let startClientX = 0;
  let startClientY = 0;
  let moveDist = 0;
  let dragging = false;
  let longPressTriggered = false;
  let lastEvent = null;
  let gestureId = null;
  let toggleBusy = false;
  let ignoreUntil = 0;

  function clearLongPress() {
    if (longPressTimer != null) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  function blockToggle(ms) {
    ignoreUntil = Math.max(ignoreUntil, Date.now() + (ms || 0));
  }

  function isToggleBlocked() {
    if (toggleBusy) return true;
    if (Date.now() < ignoreUntil) return true;
    if (handlers.isBlocked && handlers.isBlocked()) return true;
    return false;
  }

  function beginDrag(e) {
    if (dragging) return;
    dragging = true;
    clearLongPress();
    if (handlers.onDragStart) handlers.onDragStart(e || lastEvent);
  }

  /**
   * @param {PointerEvent} e
   */
  function onPointerDown(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return null;
    if (activePointer != null) return null;

    gestureId = null;
    activePointer = e.pointerId;
    startClientX = e.clientX;
    startClientY = e.clientY;
    moveDist = 0;
    dragging = false;
    longPressTriggered = false;
    lastEvent = e;

    clearLongPress();
    longPressTimer = setTimeout(function () {
      if (activePointer == null) return;
      // Armed only — drag starts on move; stay-put release → long-press tap
      longPressTriggered = true;
    }, longPressMs);

    return { startClientX: startClientX, startClientY: startClientY };
  }

  /**
   * @param {PointerEvent} e
   * @returns {"drag" | "pending" | "ignore"}
   */
  function onPointerMove(e) {
    if (activePointer == null || e.pointerId !== activePointer) return "ignore";
    if (e.pointerType === "mouse" && e.buttons === 0) return "ignore";

    lastEvent = e;
    const dx = e.clientX - startClientX;
    const dy = e.clientY - startClientY;
    moveDist = Math.sqrt(dx * dx + dy * dy);

    if (!dragging && moveDist > clickThreshold) {
      beginDrag(e);
      return "drag";
    }
    return dragging ? "drag" : "pending";
  }

  /**
   * @param {PointerEvent} e
   * @param {{ wasDragging?: boolean, pointerId?: number }} session
   */
  function onPointerUp(e, session) {
    const pid =
      session && session.pointerId != null
        ? session.pointerId
        : e && e.pointerId;
    if (
      session &&
      session.pointerId == null &&
      activePointer != null &&
      e &&
      e.pointerId !== activePointer
    ) {
      return;
    }

    const wasLong = longPressTriggered;
    const dist = moveDist;
    clearLongPress();
    activePointer = null;

    const wasDrag = (session && session.wasDragging) || dragging;
    dragging = false;
    longPressTriggered = false;

    if (wasDrag) return;

    if (gestureId === pid) return;
    gestureId = pid;
    setTimeout(function () {
      if (gestureId === pid) gestureId = null;
    }, 600);

    if (isToggleBlocked()) return;

    // Long-press + little movement → launcher / long-press action
    if (wasLong && dist <= longPressTapMax) {
      toggleBusy = true;
      try {
        if (handlers.onLongPressTap) handlers.onLongPressTap(e || lastEvent);
      } finally {
        setTimeout(function () {
          toggleBusy = false;
        }, 50);
      }
      blockToggle(400);
      return;
    }

    // Short tap
    if (!wasLong) {
      toggleBusy = true;
      try {
        if (handlers.onToggle) handlers.onToggle();
      } finally {
        setTimeout(function () {
          toggleBusy = false;
        }, 50);
      }
    }
  }

  function cancel() {
    clearLongPress();
    activePointer = null;
    dragging = false;
    longPressTriggered = false;
  }

  return {
    onPointerDown: onPointerDown,
    onPointerMove: onPointerMove,
    onPointerUp: onPointerUp,
    cancel: cancel,
    blockToggle: blockToggle,
    isToggleBlocked: isToggleBlocked,
    getActivePointer: function () {
      return activePointer;
    },
    getStart: function () {
      return { x: startClientX, y: startClientY };
    },
    isDragging: function () {
      return dragging;
    },
    wasLongPress: function () {
      return longPressTriggered;
    },
    getMoveDist: function () {
      return moveDist;
    },
    getIgnoreUntil: function () {
      return ignoreUntil;
    },
  };
}

if (typeof createGesture !== 'undefined') __mod.createGesture = createGesture;

};

/* ---- src/interaction/Drag.js ---- */
__modules["src/interaction/Drag.js"] = function (__mod, __require) {
/**
 * FWF Interaction — Drag
 *
 * Owns: pointer capture session, delta → position intent.
 * Does NOT: snap, dock UI, or render classes.
 */

/**
 * @typedef {Object} DragContext
 * @property {() => { x: number, y: number }} getPosition
 * @property {(x: number, y: number) => void} setPosition
 * @property {(x: number, y: number) => [number, number]} clampPosition
 * @property {(freeX: number, clientX: number) => number} [applyMagneticX]
 * @property {() => void} [onDragBegin]  — collapse UI, clear dock, etc.
 * @property {() => void} [onDragEnd]
 */

/**
 * @param {DragContext} ctx
 */function createDrag(ctx) {
  let originX = 0;
  let originY = 0;
  let active = false;

  function begin(startPos) {
    originX = startPos.x;
    originY = startPos.y;
    active = true;
    if (ctx.onDragBegin) ctx.onDragBegin();
  }

  /**
   * @param {number} dx
   * @param {number} dy
   * @param {number} clientX
   * @param {{ startClientX?: number }} [pointerStart] — gesture start for magnetic session
   */
  function move(dx, dy, clientX, pointerStart) {
    if (!active) return;
    let freeX = originX + dx;
    if (ctx.applyMagneticX) {
      freeX = ctx.applyMagneticX(freeX, clientX, {
        getOriginX: function () {
          return originX;
        },
        setOriginX: function (x) {
          originX = x;
        },
        startClientX:
          pointerStart && pointerStart.startClientX != null
            ? pointerStart.startClientX
            : pointerStart && pointerStart.x != null
              ? pointerStart.x
              : undefined,
      });
    }
    const [nx, ny] = ctx.clampPosition(freeX, originY + dy);
    ctx.setPosition(nx, ny);
  }

  function end() {
    if (!active) return false;
    active = false;
    if (ctx.onDragEnd) ctx.onDragEnd();
    return true;
  }

  return {
    begin: begin,
    move: move,
    end: end,
    isActive: function () {
      return active;
    },
    getOrigin: function () {
      return { x: originX, y: originY };
    },
    setOriginX: function (x) {
      originX = x;
    },
  };
}

if (typeof createDrag !== 'undefined') __mod.createDrag = createDrag;

};

/* ---- src/interaction/Snap.js ---- */
__modules["src/interaction/Snap.js"] = function (__mod, __require) {
/**
 * FWF Interaction — Snap
 *
 * Owns: edge thresholds, magnetic hysteresis, release → dock side.
 * Does NOT: set DOM classes or dock expanded UI.
 */

/**
 * @typedef {Object} SnapConfig
 * @property {number} snapThreshold
 * @property {number} snapRelease
 * @property {number} snapThresholdMobile
 * @property {number} snapReleaseMobile
 * @property {number} ballSize
 * @property {number} ballSizeMobile
 */

/**
 * @typedef {Object} SnapContext
 * @property {() => boolean} isMobile
 * @property {() => HTMLElement | null} getRoot
 * @property {() => number} getPosX
 * @property {() => number} getPosY
 * @property {(x: number, y: number) => void} setPosition
 * @property {(x: number, y: number) => [number, number]} clampPosition
 * @property {(side: "left"|"right"|null) => void} onSnapSide
 * @property {() => void} [onSnappingStart]
 * @property {() => void} [onSnappingEnd]
 */

/**
 * @param {SnapConfig} config
 * @param {SnapContext} ctx
 */function createSnap(config, ctx) {
  let magnetSide = null; // "left" | "right" | null

  function getBallSize() {
    return ctx.isMobile() ? config.ballSizeMobile : config.ballSize;
  }

  function getSnapTargets() {
    const root = ctx.getRoot();
    const vw = window.innerWidth;
    const leftBase = root
      ? parseFloat(getComputedStyle(root).left) || 20
      : 20;
    const w = getBallSize();
    const edgePad = ctx.isMobile() ? 12 : 16;
    return {
      leftBase,
      w,
      leftX: edgePad - leftBase,
      rightX: vw - w - edgePad - leftBase,
      vw,
    };
  }

  function getSnapDistances() {
    const mobile = ctx.isMobile() || "ontouchstart" in window;
    return {
      enter: mobile ? config.snapThresholdMobile : config.snapThreshold,
      leave: mobile ? config.snapReleaseMobile : config.snapRelease,
    };
  }

  /**
   * Live magnetic X while dragging.
   * @param {number} freeX
   * @param {number} clientX
   * @param {{ originX?: number, startClientX?: number, getOriginX?: Function, setOriginX?: Function }} session
   */
  function applyMagneticX(freeX, clientX, session) {
    const { leftBase, w, leftX, rightX, vw } = getSnapTargets();
    const { enter, leave } = getSnapDistances();
    const absLeft = leftBase + freeX;
    const absRight = absLeft + w;
    session = session || {};

    function getOx() {
      if (typeof session.getOriginX === "function") return session.getOriginX();
      if (session.originX != null) return session.originX;
      return 0;
    }
    function setOx(x) {
      if (typeof session.setOriginX === "function") session.setOriginX(x);
      else session.originX = x;
    }
    function getStartX() {
      return session.startClientX != null ? session.startClientX : 0;
    }
    function setMagnet(side) {
      magnetSide = side;
      if (ctx.onMagnetChange) ctx.onMagnetChange(side);
    }

    if (magnetSide === "left") {
      let tentative = getOx() + (clientX - getStartX());
      if (tentative < leftX) {
        setOx(leftX - (clientX - getStartX()));
        return leftX;
      }
      if (tentative - leftX >= leave) {
        setMagnet(null);
        return tentative;
      }
      return leftX;
    }
    if (magnetSide === "right") {
      let tentative = getOx() + (clientX - getStartX());
      if (tentative > rightX) {
        setOx(rightX - (clientX - getStartX()));
        return rightX;
      }
      if (rightX - tentative >= leave) {
        setMagnet(null);
        return tentative;
      }
      return rightX;
    }
    if (absLeft < enter) {
      setMagnet("left");
      setOx(leftX - (clientX - getStartX()));
      return leftX;
    }
    if (absRight > vw - enter) {
      setMagnet("right");
      setOx(rightX - (clientX - getStartX()));
      return rightX;
    }
    return freeX;
  }

  function snapToEdge() {
    const { leftBase, w, leftX, rightX, vw } = getSnapTargets();
    const { enter } = getSnapDistances();
    const posX = ctx.getPosX();
    const posY = ctx.getPosY();
    const absLeft = leftBase + posX;
    const absRight = absLeft + w;
    let targetX = posX;
    let finalSide = null;

    if (magnetSide === "left" || absLeft < enter) {
      targetX = leftX;
      finalSide = "left";
    } else if (magnetSide === "right" || absRight > vw - enter) {
      targetX = rightX;
      finalSide = "right";
    }

    const [cx, cy] = ctx.clampPosition(targetX, posY);
    const moved = Math.abs(cx - posX) > 0.5 || Math.abs(cy - posY) > 0.5;
    ctx.setPosition(cx, cy);
    magnetSide = null;
    if (ctx.onMagnetChange) ctx.onMagnetChange(null);

    if (moved && ctx.onSnappingStart) {
      ctx.onSnappingStart();
      setTimeout(() => {
        if (ctx.onSnappingEnd) ctx.onSnappingEnd();
      }, 400);
    } else if (!moved && ctx.onSnappingEnd) {
      // still clear magnet visuals
    }

    if (ctx.onSnapSide) ctx.onSnapSide(finalSide);
    return finalSide;
  }

  function clearMagnet() {
    magnetSide = null;
  }

  function getMagnetSide() {
    return magnetSide;
  }

  /** Near-edge test without requiring is-docked class */
  function isNearDockEdge(posX) {
    const x = posX != null ? posX : ctx.getPosX();
    const { leftBase, w, leftX, rightX, vw } = getSnapTargets();
    const { enter } = getSnapDistances();
    const absLeft = leftBase + x;
    const absRight = absLeft + w;
    const th = enter + 20;
    if (absLeft < th || Math.abs(x - leftX) < 10) return "left";
    if (absRight > vw - th || Math.abs(x - rightX) < 10) return "right";
    return null;
  }

  function syncDockFromPosition(posX, dragging) {
    if (dragging) return null;
    const x = posX != null ? posX : ctx.getPosX();
    const { leftBase, w, leftX, rightX, vw } = getSnapTargets();
    const { enter } = getSnapDistances();
    const absLeft = leftBase + x;
    const absRight = absLeft + w;
    const threshold = enter + 8;
    if (absLeft < threshold || Math.abs(x - leftX) < 4) return "left";
    if (absRight > vw - threshold || Math.abs(x - rightX) < 4) return "right";
    return null;
  }

  return {
    applyMagneticX,
    snapToEdge,
    clearMagnet,
    getMagnetSide,
    isNearDockEdge,
    syncDockFromPosition,
    getSnapTargets,
    getSnapDistances,
    getBallSize,
  };
}

if (typeof createSnap !== 'undefined') __mod.createSnap = createSnap;

};

/* ---- src/interaction/Dock.js ---- */
__modules["src/interaction/Dock.js"] = function (__mod, __require) {
/**
 * FWF Interaction — Dock
 *
 * Owns: mode edge ↔ DOCK, expanded / closing sub-state, last side memory.
 * Does NOT: implement free PANEL width, playlist data, or audio.
 */

/**
 * @typedef {Object} DockState
 * @property {"left"|"right"|null} side
 * @property {boolean} expanded
 * @property {boolean} closing
 */

/**
 * @typedef {Object} DockHandlers
 * @property {(side: "left"|"right") => void} [onDock]
 * @property {() => void} [onUndock]
 * @property {(expanded: boolean) => void} [onExpandedChange]
 * @property {() => void} [lockAnchor]  — keep ball on ideal edge coords
 * @property {() => void} [updateDirection] — dock-down vs up stack
 * @property {() => void} [sync]
 * @property {number} [closeAnimMs]
 */

/**
 * @param {DockHandlers} [handlers]
 */function createDock(handlers) {
  const h = handlers || {};
  /** @type {DockState} */
  let state = {
    side: null,
    expanded: false,
    closing: false,
  };
  let closeTimer = null;

  function getState() {
    return { ...state };
  }

  function isDocked() {
    return !!state.side;
  }

  /**
   * @param {"left"|"right"|null} side
   */
  function setSide(side) {
    if (side === "left" || side === "right") {
      state.side = side;
      state.closing = false;
      if (h.onDock) h.onDock(side);
      if (h.lockAnchor) h.lockAnchor(side);
      if (h.updateDirection) h.updateDirection();
      if (h.sync) h.sync();
    } else {
      state.expanded = false;
      state.closing = false;
      if (h.onUndock) h.onUndock();
      // side cleared only when caller decides (may keep during drag)
      if (h.sync) h.sync();
    }
  }

  function clearSide() {
    state.side = null;
    state.expanded = false;
    state.closing = false;
    if (h.sync) h.sync();
  }

  /**
   * Toggle or set dock expanded (function balls), with closing animation.
   * @param {boolean} open
   */
  function setExpanded(open) {
    open = !!open;
    if (!state.side) return;

    if (!open) {
      state.expanded = false;
      state.closing = true;
      if (h.onExpandedChange) h.onExpandedChange(false);
      if (h.lockAnchor) h.lockAnchor(state.side);
      if (h.sync) h.sync();

      if (closeTimer) clearTimeout(closeTimer);
      closeTimer = setTimeout(() => {
        state.closing = false;
        closeTimer = null;
        if (h.lockAnchor) h.lockAnchor(state.side);
        if (h.onCloseAnimEnd) h.onCloseAnimEnd();
        if (h.sync) h.sync();
      }, h.closeAnimMs != null ? h.closeAnimMs : 320);
      return;
    }

    state.closing = false;
    state.expanded = true;
    if (h.lockAnchor) h.lockAnchor(state.side);
    if (h.updateDirection) h.updateDirection();
    if (h.onExpandedChange) h.onExpandedChange(true);
    if (h.sync) h.sync();
  }

  function isClosing() {
    return state.closing;
  }

  function isExpanded() {
    return state.expanded && !state.closing;
  }

  return {
    getState,
    isDocked,
    setSide,
    clearSide,
    setExpanded,
    isClosing,
    isExpanded,
    getSide: () => state.side,
  };
}

if (typeof createDock !== 'undefined') __mod.createDock = createDock;

};

/* ---- src/interaction/ExpandPolicy.js ---- */
__modules["src/interaction/ExpandPolicy.js"] = function (__mod, __require) {
/**
 * FWF Interaction — ExpandPolicy
 *
 * Pure layout policy for floating shells:
 * - free panel: expandLeft / expandDown
 * - dock function stack: dockDown
 *
 * Host/Renderer only applies classes & transforms.
 */

/**
 * @typedef {Object} ExpandInput
 * @property {number} absLeft
 * @property {number} absTop
 * @property {number} ballW
 * @property {number} ballH
 * @property {number} openW
 * @property {number} openH
 * @property {number} viewportW
 * @property {number} viewportH
 * @property {"left"|"right"|null} [dockSide]
 * @property {number} [pad=12]
 */

/**
 * Free / panel open direction.
 * @param {ExpandInput} input
 * @returns {{ expandLeft: boolean, expandDown: boolean }}
 */function resolveExpandDirection(input) {
  const pad = input.pad != null ? input.pad : 12;
  const vw = input.viewportW;
  const vh = input.viewportH;
  const openW = input.openW;
  const openH = input.openH;
  const ballH = input.ballH;
  const absLeft = input.absLeft;
  const absTop = input.absTop;
  const dockSide = input.dockSide || null;

  let expandLeft = false;
  if (dockSide === "right") {
    expandLeft = true;
  } else if (dockSide === "left") {
    expandLeft = false;
  } else {
    expandLeft = absLeft + openW > vw - pad;
  }

  const spaceAbove = absTop;
  const spaceBelow = vh - (absTop + ballH);
  const expandDown =
    spaceAbove < openH + pad && spaceBelow > spaceAbove;

  return { expandLeft: !!expandLeft, expandDown: !!expandDown };
}

/**
 * Dock 功能球纵向：上方不够堆叠高度且下方更宽裕 → 向下排。
 * @param {{ absTop: number, absBottom: number, stackH: number, viewportH: number, pad?: number }} input
 * @returns {{ dockDown: boolean }}
 */function resolveDockStackDirection(input) {
  const pad = input.pad != null ? input.pad : 8;
  const spaceAbove = input.absTop;
  const spaceBelow = input.viewportH - input.absBottom;
  const dockDown =
    spaceAbove < input.stackH + pad && spaceBelow > spaceAbove;
  return { dockDown: !!dockDown };
}

/**
 * bottom 锚定壳：展开后高度变大默认往上长。
 * expandDown 时需要额外 translateY，使「球顶」大致不动、面板往下长。
 * 返回值加到现有 posY 上（CSS transform 正值向下）。
 *
 * @param {boolean} isOpen
 * @param {boolean} expandDown
 * @param {number} ballH
 * @param {number} openH
 */function expandDownTranslateY(isOpen, expandDown, ballH, openH) {
  if (isOpen && expandDown) return openH - ballH;
  return 0;
}

if (typeof resolveExpandDirection !== 'undefined') __mod.resolveExpandDirection = resolveExpandDirection;
if (typeof resolveDockStackDirection !== 'undefined') __mod.resolveDockStackDirection = resolveDockStackDirection;
if (typeof expandDownTranslateY !== 'undefined') __mod.expandDownTranslateY = expandDownTranslateY;

};

/* ---- src/interaction/Layout.js ---- */
__modules["src/interaction/Layout.js"] = function (__mod, __require) {
var __dep0 = __require("src/interaction/ExpandPolicy.js");
var resolveExpandDirection = __dep0.resolveExpandDirection;
var resolveDockStackDirection = __dep0.resolveDockStackDirection;
/**
 * FWF Interaction — Layout
 *
 * Owns: PANEL expand direction (via ExpandPolicy), mobile card geometry,
 * list-up, dock-down. Does NOT: pointer stream.
 */
/**
 * @typedef {Object} LayoutContext
 * @property {() => HTMLElement | null} getRoot
 * @property {() => boolean} isMobile
 * @property {() => boolean} isDocked
 * @property {() => boolean} isDragging
 * @property {() => boolean} isOpen
 * @property {() => number} getPosX
 * @property {() => number} getPosY
 * @property {(x: number, y: number, w?: number, h?: number) => [number, number]} clampPosition
 * @property {(x: number, y: number) => void} setPosition
 * @property {() => number} getBallSize
 * @property {() => "left"|"right"|null} [getDockSide]
 * @property {(expandLeft: boolean) => void} [onExpandLeft]
 * @property {(expandDown: boolean) => void} [onExpandDown]
 * @property {() => void} [sync]
 */

/**
 * @param {LayoutContext} ctx
 */function createLayout(ctx) {
  let expandLeft = false;
  let expandDown = false;
  let listUp = false;

  function getExpandLeft() {
    return expandLeft;
  }

  function getExpandDown() {
    return expandDown;
  }

  function setExpandLeft(v) {
    expandLeft = !!v;
    if (ctx.onExpandLeft) ctx.onExpandLeft(expandLeft);
    if (ctx.sync) ctx.sync();
  }

  function setExpandDown(v) {
    expandDown = !!v;
    if (ctx.onExpandDown) ctx.onExpandDown(expandDown);
    if (ctx.sync) ctx.sync();
  }

  function measureOpenWidth(root) {
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
    return openW;
  }

  /**
   * Desktop / free PANEL: ExpandPolicy decides left/right (and vertical hint).
   * Docked music UI does not use free-panel expand-left.
   */
  function updateExpandDirection() {
    if (!ctx.getRoot() || ctx.isDocked() || ctx.isDragging()) {
      setExpandLeft(false);
      setExpandDown(false);
      return;
    }
    if (ctx.isMobile() && ctx.isOpen()) return;

    const root = ctx.getRoot();
    const leftBase = parseFloat(getComputedStyle(root).left) || 20;
    const ball = ctx.getBallSize();
    const openW = measureOpenWidth(root);
    const rect = root.getBoundingClientRect();
    const absLeft = leftBase + ctx.getPosX();
    const absTop = rect.top;
    const dockSide =
      typeof ctx.getDockSide === "function" ? ctx.getDockSide() : null;

    const result = resolveExpandDirection({
      absLeft: absLeft,
      absTop: absTop,
      ballW: ball,
      ballH: ball,
      openW: openW,
      openH: Math.max(ball, 80),
      viewportW: window.innerWidth,
      viewportH: window.innerHeight,
      dockSide: dockSide,
      pad: 12,
    });

    setExpandLeft(result.expandLeft);
    setExpandDown(result.expandDown);
  }

  function getMobileCardSize() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(vw * 0.72, 260);
    const h = Math.min(vh * 0.34, 210);
    return { w: Math.max(180, Math.round(w)), h: Math.max(140, Math.round(h)) };
  }

  /**
   * Mobile free PANEL open:
   * 1) Prefer expand right if openW fits.
   * 2) Else expand left (margin-left keeps ball edge).
   * 3) If neither side fits, shift horizontally so the open card stays in the viewport.
   * Vertical: clamp so open height stays on screen.
   */
  function prepareMobileOpen() {
    if (!ctx.getRoot() || !ctx.isMobile()) return;
    if (ctx.isDocked()) return;

    const { w: openW, h: openH } = getMobileCardSize();
    const root = ctx.getRoot();
    const leftBase = parseFloat(getComputedStyle(root).left) || 20;
    const ballW = ctx.getBallSize();
    const vw = window.innerWidth;
    const pad = 8;
    let absLeft = leftBase + ctx.getPosX();

    const canExpandRight = absLeft + openW <= vw - pad;
    const canExpandLeft = absLeft + ballW - openW >= pad;

    let expandLeftFlag = false;

    if (canExpandRight) {
      expandLeftFlag = false;
    } else if (canExpandLeft) {
      expandLeftFlag = true;
    } else {
      // Neither side fits without moving — shift so open card is fully in view.
      // Prefer left-expand when ball is on the right half; otherwise right-expand.
      const ballCenter = absLeft + ballW / 2;
      if (ballCenter >= vw / 2) {
        expandLeftFlag = true;
        // expand-left: card left ≈ absLeft + ballW - openW, right ≈ absLeft + ballW
        const minAbs = pad - ballW + openW;
        const maxAbs = vw - pad - ballW;
        absLeft = Math.min(Math.max(absLeft, minAbs), Math.max(minAbs, maxAbs));
      } else {
        expandLeftFlag = false;
        const minAbs = pad;
        const maxAbs = vw - pad - openW;
        absLeft = Math.min(Math.max(absLeft, minAbs), Math.max(minAbs, maxAbs));
      }
      ctx.setPosition(absLeft - leftBase, ctx.getPosY());
    }

    // Vertical clamp for open card height (ball width as footprint X)
    const [cx, cy] = ctx.clampPosition(
      ctx.getPosX(),
      ctx.getPosY(),
      ballW,
      openH
    );
    if (cx !== ctx.getPosX() || cy !== ctx.getPosY()) {
      ctx.setPosition(cx, cy);
    }
    absLeft = leftBase + ctx.getPosX();

    const rect = root.getBoundingClientRect();
    const result = resolveExpandDirection({
      absLeft: absLeft,
      absTop: rect.top,
      ballW: ballW,
      ballH: ballW,
      openW: openW,
      openH: openH,
      viewportW: vw,
      viewportH: window.innerHeight,
      dockSide: null,
      pad: pad,
    });
    // Horizontal side already decided above; ExpandPolicy only for vertical
    setExpandLeft(expandLeftFlag);
    setExpandDown(result.expandDown);
  }

  function updateListDirection() {
    const root = ctx.getRoot();
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const listH =
      parseInt(getComputedStyle(root).getPropertyValue("--mp-list-h"), 10) ||
      280;
    // Default: expand list downward. If not enough space below → upward (bar stays).
    const spaceBelow = window.innerHeight - rect.bottom;
    const need = listH + 16;
    setListUp(spaceBelow < need);
  }

  function getListUp() {
    return listUp;
  }

  function setListUp(v) {
    listUp = !!v;
    if (ctx.onListUp) ctx.onListUp(listUp);
    if (ctx.sync) ctx.sync();
  }

  /**
   * Mobile dock button stack: open downward when near top.
   */
  function shouldDockDown() {
    const root = ctx.getRoot();
    if (!root || !ctx.isMobile() || !ctx.isDocked()) return false;
    const rect = root.getBoundingClientRect();
    const n = root.querySelectorAll(".mp-dock-btn").length || 5;
    const stackH = n * 40 + (n - 1) * 8 + 12;
    return resolveDockStackDirection({
      absTop: rect.top,
      absBottom: rect.bottom,
      stackH: stackH,
      viewportH: window.innerHeight,
      pad: 8,
    }).dockDown;
  }

  return {
    getExpandLeft,
    setExpandLeft,
    getExpandDown,
    setExpandDown,
    updateExpandDirection,
    prepareMobileOpen,
    getMobileCardSize,
    updateListDirection,
    getListUp,
    setListUp,
    shouldDockDown,
  };
}

if (typeof createLayout !== 'undefined') __mod.createLayout = createLayout;

};

/* ---- src/media/AudioEngine.js ---- */
__modules["src/media/AudioEngine.js"] = function (__mod, __require) {
/**
 * FWF Media — AudioEngine
 *
 * Owns: HTMLAudioElement lifecycle, play/pause/seek, ended/error.
 * Does NOT: playlist order, UI, dock, shell position.
 */

/**
 * @typedef {Object} AudioEngineHandlers
 * @property {() => void} [onPlay]
 * @property {() => void} [onPause]
 * @property {() => void} [onTimeUpdate]
 * @property {() => void} [onEnded]
 * @property {() => void} [onError]
 * @property {() => void} [onLoadedMetadata]
 */

/**
 * @param {AudioEngineHandlers} [handlers]
 */function createAudioEngine(handlers) {
  const h = handlers || {};
  /** @type {HTMLAudioElement | null} */
  let el = null;
  let volume = 0.7;

  function ensure() {
    if (el) return el;
    el = new Audio();
    el.preload = "metadata";
    el.volume = volume;
    el.addEventListener("timeupdate", function () {
      if (h.onTimeUpdate) h.onTimeUpdate();
    });
    el.addEventListener("ended", function () {
      if (h.onEnded) h.onEnded();
    });
    el.addEventListener("play", function () {
      if (h.onPlay) h.onPlay();
    });
    el.addEventListener("pause", function () {
      if (h.onPause) h.onPause();
    });
    el.addEventListener("error", function () {
      if (h.onError) h.onError();
    });
    el.addEventListener("loadedmetadata", function () {
      if (h.onLoadedMetadata) h.onLoadedMetadata();
    });
    return el;
  }

  function setSource(url) {
    ensure();
    el.src = url || "";
    el.load();
  }

  function play() {
    ensure();
    const p = el.play();
    if (p && p.catch) p.catch(function () {});
    return p;
  }

  function pause() {
    if (el) el.pause();
  }

  function toggle() {
    ensure();
    if (el.paused) return play();
    pause();
  }

  function seek(ratio) {
    if (!el || !isFinite(el.duration)) return;
    const r = Math.min(1, Math.max(0, ratio));
    el.currentTime = r * el.duration;
  }

  function setCurrentTime(t) {
    if (!el) return;
    el.currentTime = t;
  }

  function setVolume(v) {
    volume = Math.min(1, Math.max(0, v));
    if (el) el.volume = volume;
  }

  function getVolume() {
    return volume;
  }

  function getCurrentTime() {
    return el ? el.currentTime || 0 : 0;
  }

  function getDuration() {
    return el && isFinite(el.duration) ? el.duration : 0;
  }

  function isPaused() {
    return !el || el.paused;
  }

  function hasSource() {
    return !!(el && el.src);
  }

  function getElement() {
    return el;
  }

  function destroy() {
    if (!el) return;
    el.pause();
    el.removeAttribute("src");
    el.load();
    el = null;
  }

  return {
    ensure: ensure,
    setSource: setSource,
    play: play,
    pause: pause,
    toggle: toggle,
    seek: seek,
    setCurrentTime: setCurrentTime,
    setVolume: setVolume,
    getVolume: getVolume,
    getCurrentTime: getCurrentTime,
    getDuration: getDuration,
    isPaused: isPaused,
    hasSource: hasSource,
    getElement: getElement,
    destroy: destroy,
  };
}

if (typeof createAudioEngine !== 'undefined') __mod.createAudioEngine = createAudioEngine;

};

/* ---- src/host/music-player-host.js ---- */
__modules["src/host/music-player-host.js"] = function (__mod, __require) {
var __dep0 = __require("src/interaction/Gesture.js");
var createGesture = __dep0.createGesture;
var __dep1 = __require("src/interaction/Drag.js");
var createDrag = __dep1.createDrag;
var __dep2 = __require("src/interaction/Snap.js");
var createSnap = __dep2.createSnap;
var __dep3 = __require("src/interaction/Dock.js");
var createDock = __dep3.createDock;
var __dep4 = __require("src/interaction/Layout.js");
var createLayout = __dep4.createLayout;
var __dep5 = __require("src/media/AudioEngine.js");
var createAudioEngine = __dep5.createAudioEngine;
var __dep6 = __require("src/core/LifecycleScope.js");
var createLifecycleScope = __dep6.createLifecycleScope;
/**
 * FWF Music Player Host（模块源码，请用 npm run build 打包后再给 Hexo 使用）
 */
const _userCfg = (typeof window !== "undefined" && window.FWF_MUSIC) ? window.FWF_MUSIC : {};
const CONFIG = {
    server: _userCfg.server || "netease",
    type: _userCfg.type || "playlist",
    id: _userCfg.id || "3778678",
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
    longPressMs: 550,
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
    var t = 0;
    if (musicEngine) t = musicEngine.getCurrentTime();
    else if (audio) t = audio.currentTime || 0;
    saveState({ position: { x: posX, y: posY }, volume, loopMode, orderMode, index: currentIndex, time: t });
  }

  // =========================================================================
  // Phase 1 — Shell State projection (single writer for managed root classes)
  // Legacy flags remain source of truth; Renderer-style sync is the only place
  // that writes managed classList on #music-player.
  // =========================================================================
  const MANAGED_CLASSES = [
    "is-open", "is-docked", "dock-left", "dock-right",
    "is-dragging", "is-snapping", "is-dock-closing",
    "expand-left", "is-list-open", "is-list-closing", "list-up",
    "dock-list-open", "dock-down", "is-playing", "is-mobile",
    "no-hover-expand", "is-magnet", "magnet-left", "magnet-right"
  ];

  // Ephemeral UI flags that previously lived only on classList
  let shellSnapping = false;
  let shellDockClosing = false;
  let shellNoHoverExpand = false;
  let shellExpandLeft = false;
  let shellListClosing = false;
  let shellListUp = false;
  let shellDockDown = false;
  let shellMagnet = false;
  let shellMagnetSide = null; // "left" | "right" | null

  /**
   * Normalize-inspired projection: derive desired classes from legacy + shell flags.
   * Illegal combos are resolved here the same way baseline behaved.
   */
  function shellSync() {
    if (!root) return;

    const desired = new Set();

    // mobile / playing
    if (isMobile) desired.add("is-mobile");
    if (isPlaying) desired.add("is-playing");

    // dragging forces collapsed visual (baseline: collapse while drag)
    const effectivelyDragging = !!dragging;
    if (effectivelyDragging) desired.add("is-dragging");

    // dock: lastDockSide is the source of truth (set by setDocked / snap)
    const isDocked = !!lastDockSide && !effectivelyDragging;

    if (isDocked && lastDockSide) {
      desired.add("is-docked");
      if (lastDockSide === "left") desired.add("dock-left");
      if (lastDockSide === "right") desired.add("dock-right");
    }

    // open / dock expanded
    // baseline: is-open means PANEL open OR dock expanded
    if (!effectivelyDragging) {
      if (isDocked) {
        if (isOpen && !shellDockClosing) desired.add("is-open");
        if (shellDockClosing) desired.add("is-dock-closing");
      } else {
        if (isOpen) desired.add("is-open");
      }
    }

    // list
    if (!effectivelyDragging) {
      if (isListOpen && !shellListClosing) desired.add("is-list-open");
      if (shellListClosing) desired.add("is-list-closing");
      if (shellListUp && (isListOpen || shellListClosing)) desired.add("list-up");
    }

    if (isDockListOpen) desired.add("dock-list-open");
    if (shellDockDown && isDocked) desired.add("dock-down");

    // expand-left: position-based (desktop hover OR forced open).
    // Must NOT require isOpen — pure :hover expand never sets isOpen.
    // Ball stays put; CSS margin-left pulls the panel left when space on the right is insufficient.
    if (shellExpandLeft && !isDocked && !effectivelyDragging) {
      desired.add("expand-left");
    }

    // snapping / magnet / no-hover
    if (shellSnapping) desired.add("is-snapping");
    if (shellNoHoverExpand) desired.add("no-hover-expand");
    if (shellMagnet && effectivelyDragging) {
      desired.add("is-magnet");
      if (shellMagnetSide === "left") desired.add("magnet-left");
      if (shellMagnetSide === "right") desired.add("magnet-right");
    }

    // Apply — only managed classes
    for (let i = 0; i < MANAGED_CLASSES.length; i++) {
      const cls = MANAGED_CLASSES[i];
      const on = desired.has(cls);
      if (on) root.classList.add(cls);
      else root.classList.remove(cls);
    }
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

  // =========================================================================
  // [Interaction:Snap] inlined from src/interaction/Snap.js
  // Owns: thresholds, magnetic hysteresis, snapToEdge → dock side
  // =========================================================================
  var snap = null;

  function ensureSnap() {
    if (snap) return snap;
    snap = createSnap(
      {
        snapThreshold: CONFIG.snapThreshold,
        snapRelease: CONFIG.snapRelease,
        snapThresholdMobile: CONFIG.snapThresholdMobile,
        snapReleaseMobile: CONFIG.snapReleaseMobile,
        ballSize: CONFIG.ballSize,
        ballSizeMobile: CONFIG.ballSizeMobile,
      },
      {
        isMobile: function () {
          return isMobile || window.innerWidth <= 600;
        },
        getRoot: function () {
          return root;
        },
        getPosX: function () {
          return posX;
        },
        getPosY: function () {
          return posY;
        },
        setPosition: function (x, y) {
          posX = x;
          posY = y;
          applyTransform();
        },
        clampPosition: function (x, y) {
          return clampPosition(x, y);
        },
        onSnapSide: function (side) {
          setDocked(side);
          if (typeof updateExpandDirection === "function") updateExpandDirection();
          persistNow();
        },
        onSnappingStart: function () {
          shellSnapping = true;
          shellSync();
        },
        onSnappingEnd: function () {
          shellSnapping = false;
          shellSync();
        },
        onMagnetChange: function (side) {
          magnetSide = side;
          shellMagnet = !!side;
          shellMagnetSide = side;
          shellSync();
        },
      }
    );
    return snap;
  }

  function getBallSize() {
    return ensureSnap().getBallSize();
  }
  function getSnapTargets() {
    return ensureSnap().getSnapTargets();
  }
  function getSnapDistances() {
    return ensureSnap().getSnapDistances();
  }
  function applyMagneticX(freeX, clientX, session) {
    return ensureSnap().applyMagneticX(freeX, clientX, session);
  }
  function snapToEdge() {
    if (!root) return;
    ensureSnap().snapToEdge();
  }
  function isNearDockEdge() {
    return ensureSnap().isNearDockEdge(posX);
  }
  function syncDockFromPosition() {
    if (!root || dragging) return;
    var side = ensureSnap().syncDockFromPosition(posX, dragging);
    setDocked(side);
  }

  // =========================================================================
  // [Interaction:Dock] inlined from src/interaction/Dock.js
  // Owns: side / expanded / closing (function-ball layer, not free PANEL)
  // =========================================================================
  var dockCtl = null;

  function ensureDock() {
    if (dockCtl) return dockCtl;
    dockCtl = createDock({
      closeAnimMs: 320,
      onDock: function (side) {
        lastDockSide = side;
        shellExpandLeft = false;
        shellDockDown = false;
        shellDockClosing = false;
        syncDockLoopBtn();
      },
      onUndock: function () {
        closeDockList();
        shellDockDown = false;
        shellDockClosing = false;
      },
      onExpandedChange: function (expanded) {
        isOpen = !!expanded;
        shellDockClosing = dockCtl.isClosing();
        if (!expanded) closeDockList();
      },
      onCloseAnimEnd: function () {
        shellDockClosing = false;
        guardToggle(400);
      },
      lockAnchor: function (side) {
        if (typeof lockDockAnchor === "function") lockDockAnchor(side || lastDockSide);
      },
      updateDirection: function () {
        if (typeof updateDockDirection === "function") updateDockDirection();
      },
      sync: function () {
        shellDockClosing = !!(dockCtl && dockCtl.isClosing());
        shellSync();
      },
    });
    return dockCtl;
  }

  // [Interaction:Dock] attach / detach edge mode
  function setDocked(side) {
    if (!root) return;
    var d = ensureDock();
    if (side === "left" || side === "right") {
      d.setSide(side);
    } else if (dragging) {
      // leave side memory for snap; only collapse expanded UI
      d.setSide(null);
      shellDockDown = false;
      shellSync();
    } else {
      closeDockList();
      d.clearSide();
      dockAnchorX = null;
      dockAnchorY = null;
      lastDockSide = null;
      shellDockClosing = false;
      shellDockDown = false;
      shellSync();
    }
  }

  // =========================================================================
  // [Interaction:Layout] inlined from src/interaction/Layout.js
  // Owns: expandLeft, mobile card geometry, list-up, dock-down
  // =========================================================================
  var layoutCtl = null;

  function ensureLayout() {
    if (layoutCtl) return layoutCtl;
    layoutCtl = createLayout({
      getRoot: function () {
        return root;
      },
      isMobile: function () {
        return !!isMobile;
      },
      isDocked: function () {
        return !!lastDockSide || (dockCtl && dockCtl.isDocked());
      },
      isDragging: function () {
        return !!dragging;
      },
      isOpen: function () {
        return !!isOpen;
      },
      getPosX: function () {
        return posX;
      },
      getPosY: function () {
        return posY;
      },
      clampPosition: function (x, y, w, h) {
        return clampPosition(x, y, w, h);
      },
      setPosition: function (x, y) {
        posX = x;
        posY = y;
        applyTransform();
      },
      getBallSize: function () {
        return getBallSize();
      },
      getDockSide: function () {
        return lastDockSide || null;
      },
      onExpandLeft: function (v) {
        shellExpandLeft = !!v;
      },
      onListUp: function (v) {
        shellListUp = !!v;
      },
      sync: function () {
        shellSync();
      },
    });
    return layoutCtl;
  }

  // [Interaction:Layout] PANEL expand-left when right space insufficient
  function updateExpandDirection() {
    ensureLayout().updateExpandDirection();
  }

  // [Music Widget:PlaylistSource] Meting fetch (parity with src/widgets/music/PlaylistSource.js)
  function buildApiUrl(template) { return template.replace(":server", CONFIG.server).replace(":type", CONFIG.type).replace(":id", CONFIG.id).replace(":r", String(Math.random())); }

  async function fetchPlaylist(signal) {
    let lastErr = null;
    for (const api of CONFIG.apis) {
      try {
        const res = await fetch(buildApiUrl(api), { mode: "cors", signal });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return data.map((item, i) => ({ name: item.name || item.title || "Unknown", artist: item.artist || item.author || "Unknown", url: item.url, pic: item.pic || item.cover || "", lrc: item.lrc || "", index: i }));
        }
      } catch (e) {
        if (e && e.name === "AbortError") throw e;
        lastErr = e;
      }
    }
    throw lastErr || new Error("All Meting APIs failed");
  }

  // =========================================================================
  // Phase 2 — Template: single owner of Shell DOM structure + ref binding
  // (mirrors src/ui/Template.js; inlined for Hexo single-file drop-in)
  // Slots: cover → #mp-cover | panel → .mp-body | dock → #mp-dock-btns
  //        sheet → #mp-list + #mp-dock-list
  // =========================================================================
  const Template = {
    ROOT_STYLE:
      "position:fixed;left:20px;bottom:20px;z-index:99999;display:block;visibility:visible;opacity:1;pointer-events:auto;box-sizing:border-box",
    SHELL_HTML:
      '<div class="mp-main">' +
        '<div class="mp-cover" id="mp-cover"><div class="mp-cover-play"><i class="fas fa-play"></i></div></div>' +
        '<div class="mp-body">' +
          '<div class="mp-meta">' +
            '<div class="mp-title" id="mp-title">加载中...</div>' +
            '<div class="mp-artist" id="mp-artist">—</div>' +
          "</div>" +
          '<div class="mp-controller">' +
            '<div class="mp-progress-wrap" id="mp-progress"><div class="mp-progress-bar"><div class="mp-progress-played" id="mp-played"></div></div></div>' +
            '<div class="mp-time" id="mp-time">0:00 / 0:00</div>' +
            '<div class="mp-btns">' +
              '<button class="mp-btn" id="mp-loop" type="button" title="循环"><i class="fas fa-repeat"></i></button>' +
              '<button class="mp-btn" id="mp-prev" type="button" title="上一首"><i class="fas fa-step-backward"></i></button>' +
              '<button class="mp-btn" id="mp-play" type="button" title="播放/暂停"><i class="fas fa-play"></i></button>' +
              '<button class="mp-btn" id="mp-next" type="button" title="下一首"><i class="fas fa-step-forward"></i></button>' +
              '<button class="mp-btn" id="mp-list-btn" type="button" title="歌单"><i class="fas fa-list"></i></button>' +
            "</div>" +
          "</div>" +
        "</div>" +
      "</div>" +
      '<div class="mp-dock-btns" id="mp-dock-btns" aria-hidden="true">' +
        '<button class="mp-dock-btn" id="mp-dock-play" type="button" title="播放/暂停"><i class="fas fa-play"></i></button>' +
        '<button class="mp-dock-btn" id="mp-dock-prev" type="button" title="上一首"><i class="fas fa-step-backward"></i></button>' +
        '<button class="mp-dock-btn" id="mp-dock-next" type="button" title="下一首"><i class="fas fa-step-forward"></i></button>' +
        '<button class="mp-dock-btn" id="mp-dock-loop" type="button" title="循环"><i class="fas fa-repeat"></i></button>' +
        '<button class="mp-dock-btn" id="mp-dock-list-btn" type="button" title="歌单"><i class="fas fa-list"></i></button>' +
      "</div>" +
      '<div class="mp-list" id="mp-list"><div class="mp-list-inner" id="mp-list-inner"><div class="mp-loading"><i class="fas fa-spinner"></i> 加载歌单...</div></div></div>',
    DOCK_LIST_HTML:
      '<div class="mp-dock-list-inner" id="mp-dock-list-inner"><div class="mp-loading"><i class="fas fa-spinner"></i> 加载歌单...</div></div>',

    createShell: function (parent) {
      const mount = parent || document.body;
      let el = document.getElementById("music-player");
      if (el) {
        if (!mount.contains(el)) mount.appendChild(el);
        return el;
      }
      el = document.createElement("div");
      el.id = "music-player";
      el.style.cssText = this.ROOT_STYLE;
      el.innerHTML = this.SHELL_HTML;
      mount.appendChild(el);
      return el;
    },

    createDockSheet: function (parent) {
      const mount = parent || document.body;
      let panel = document.getElementById("mp-dock-list");
      if (panel) {
        if (panel.parentElement && panel.parentElement.id === "music-player") mount.appendChild(panel);
        return panel;
      }
      panel = document.createElement("div");
      panel.className = "mp-dock-list";
      panel.id = "mp-dock-list";
      panel.setAttribute("aria-hidden", "true");
      panel.setAttribute("data-orbit-portal", "music-dock-list");
      panel.innerHTML = this.DOCK_LIST_HTML;
      mount.appendChild(panel);
      if (typeof claimOwnedPortal === "function") claimOwnedPortal(panel);
      return panel;
    },

    bindRefs: function (rootEl) {
      const dockSheet = document.getElementById("mp-dock-list");
      return {
        root: rootEl,
        cover: $("#mp-cover", rootEl),
        title: $("#mp-title", rootEl),
        artist: $("#mp-artist", rootEl),
        played: $("#mp-played", rootEl),
        time: $("#mp-time", rootEl),
        progress: $("#mp-progress", rootEl),
        list: $("#mp-list", rootEl),
        listInner: $("#mp-list-inner", rootEl),
        body: $(".mp-body", rootEl),
        dockBtns: $("#mp-dock-btns", rootEl),
        playBtn: $("#mp-play", rootEl),
        playBtnIcon: $("#mp-play i", rootEl),
        prevBtn: $("#mp-prev", rootEl),
        nextBtn: $("#mp-next", rootEl),
        loopBtn: $("#mp-loop", rootEl),
        listBtn: $("#mp-list-btn", rootEl),
        dockPlay: $("#mp-dock-play", rootEl),
        dockPlayIcon: $("#mp-dock-play i", rootEl),
        dockPrev: $("#mp-dock-prev", rootEl),
        dockNext: $("#mp-dock-next", rootEl),
        dockLoop: $("#mp-dock-loop", rootEl),
        dockListBtn: $("#mp-dock-list-btn", rootEl),
        dockSheet: dockSheet,
        dockListInner: $("#mp-dock-list-inner", dockSheet || document),
      };
    },

    mount: function (parent) {
      const rootEl = this.createShell(parent);
      this.createDockSheet(parent);
      return { root: rootEl, refs: this.bindRefs(rootEl) };
    },
  };

  function createPlayerDOM() {
    return Template.createShell(document.body);
  }

  function ensureDockListPanel() {
    return Template.createDockSheet(document.body);
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
    highlight(refs && refs.dockListInner ? refs.dockListInner : $("#mp-dock-list-inner"), isDockListOpen);
  }

  function updatePlayIcon() {
    const iconClass = isPlaying ? "fas fa-pause" : "fas fa-play";
    if (playBtnIcon) playBtnIcon.className = iconClass;
    if (dockPlayBtnIcon) dockPlayBtnIcon.className = iconClass;
    shellSync();
  }
  function updateProgress() {
    if (!playedEl || !timeEl) return;
    var cur = 0, dur = 0;
    if (musicEngine) {
      cur = musicEngine.getCurrentTime();
      dur = musicEngine.getDuration();
    } else if (audio) {
      cur = audio.currentTime || 0;
      dur = audio.duration || 0;
    } else return;
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
    const dockInner = (refs && refs.dockListInner) || $("#mp-dock-list-inner");
    if (dockInner) dockInner.innerHTML = html;
  }

  function escapeHtml(str) { return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

  // =========================================================================
  // Phase 4 — AudioEngine + Music Widget controller
  // (parity with src/media/AudioEngine.js + src/widgets/music/*)
  // Runtime/Shell does not own tracks; music lives in this controller surface.
  // =========================================================================
  var musicEngine = null;

  function ensureMusicEngine() {
    if (musicEngine) return musicEngine;
    musicEngine = createAudioEngine({
      onPlay: function () {
        isPlaying = true;
        updatePlayIcon();
        persistNow();
      },
      onPause: function () {
        isPlaying = false;
        updatePlayIcon();
        persistNow();
      },
      onTimeUpdate: function () {
        updateProgress();
      },
      onEnded: function () {
        if (loopMode === "one") {
          musicEngine.setCurrentTime(0);
          musicEngine.play();
        } else {
          playNext(false);
        }
      },
      onError: function () {
        setTimeout(function () {
          playNext(true);
        }, 800);
      },
    });
    musicEngine.setVolume(volume);
    // legacy `audio` alias for persistNow / seek restore
    audio = musicEngine.getElement() || musicEngine.ensure();
    return musicEngine;
  }

  function ensureAudio() {
    var eng = ensureMusicEngine();
    audio = eng.getElement() || eng.ensure();
    return audio;
  }

  function loadSong(index, autoPlay) {
    if (!playlist.length) return;
    currentIndex = ((index % playlist.length) + playlist.length) % playlist.length;
    var eng = ensureMusicEngine();
    eng.setSource(playlist[currentIndex].url);
    audio = eng.getElement();
    updateMeta();
    persistNow();
    if (autoPlay) eng.play();
  }

  function togglePlay() {
    var eng = ensureMusicEngine();
    if (!eng.hasSource() && playlist.length) return loadSong(currentIndex, true);
    eng.toggle();
  }

  function playNext(force) {
    if (!playlist.length) return;
    var next = orderMode === "random" ? Math.floor(Math.random() * playlist.length) : currentIndex + 1;
    if (next >= playlist.length) {
      if (loopMode === "all" || force) next = 0;
      else return;
    }
    loadSong(next, true);
  }

  function playPrev() {
    if (!playlist.length) return;
    loadSong(currentIndex - 1 < 0 ? playlist.length - 1 : currentIndex - 1, true);
  }

  function onEnded() {
    if (loopMode === "one") {
      ensureMusicEngine().setCurrentTime(0);
      ensureMusicEngine().play();
    } else playNext(false);
  }

  function seek(ratio) {
    var eng = ensureMusicEngine();
    eng.seek(ratio);
    updateProgress();
  }

  function syncDockLoopBtn() {
    const btn = (refs && refs.dockLoop) || $("#mp-dock-loop");
    if (!btn) return;
    btn.classList.toggle("active", loopMode !== "none");
    btn.title = loopMode === "all" ? "列表循环" : loopMode === "one" ? "单曲循环" : "不循环";
    const icon = btn.querySelector("i");
    if (icon) icon.className = loopMode === "one" ? "fas fa-redo" : "fas fa-repeat";
  }

  function toggleLoop() {
    const modes = ["all", "one", "none"];
    loopMode = modes[(modes.indexOf(loopMode) + 1) % modes.length];
    const btn = (refs && refs.loopBtn) || $("#mp-loop");
    if (btn) {
      btn.classList.toggle("active", loopMode !== "none");
      btn.title = loopMode === "all" ? "列表循环" : loopMode === "one" ? "单曲循环" : "不循环";
      const icon = btn.querySelector("i");
      if (icon) icon.className = loopMode === "one" ? "fas fa-redo" : "fas fa-repeat";
    }
    syncDockLoopBtn(); persistNow();
  }

  // 修改2：移动端点击展开时，主动判断展开后的尺寸卡片是否越界，做位置补偿






  // isNearDockEdge: use Snap module version above

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
    const side = lastDockSide || isNearDockEdge() || null;
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
    return ensureLayout().getMobileCardSize();
  }

  // [Interaction:Layout] mobile free-PANEL geometry
  function prepareMobileOpen() {
    if (!root || !isMobile) return;
    if (lastDockSide || shellDockClosing) return;
    if (typeof isNearDockEdge === "function" && isNearDockEdge()) return;
    if (typeof dockAnchorX !== "undefined" && dockAnchorX != null) return;
    ensureLayout().prepareMobileOpen();
  }

  function updateDockDirection() {
    if (!root) return;
    shellDockDown = ensureLayout().shouldDockDown();
    shellSync();
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
    if (shellDockClosing || ensureDock().isClosing()) return;

    ballToggleBusy = true;
    try {
      const near = isNearDockEdge();
      const d = ensureDock();
      const docked = !!lastDockSide || d.isDocked() || !!near;
      // dock expanded or free panel open
      const open = d.isDocked() ? d.isExpanded() || !!isOpen : !!isOpen;

      if (docked) {
        const side = near || lastDockSide || d.getSide() || "left";
        if (!d.isDocked() && !lastDockSide) setDocked(side);
        else lockDockAnchor(side);

        if (open) {
          guardToggle(1000);
          setOpen(false);
        } else {
          guardToggle(450);
          lockDockAnchor(side);
          setOpen(true);
        }
        return;
      }

      guardToggle(450);
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
    var d = ensureDock();
    if (open && (shellDockClosing || d.isClosing())) return;

    const near = typeof isNearDockEdge === "function" ? isNearDockEdge() : null;
    const docked = !!lastDockSide || d.isDocked() || (isMobile && !!near);

    if (docked) {
      const side = near || lastDockSide || d.getSide() || "left";
      if (!d.isDocked() && !lastDockSide) setDocked(side);
      else if (typeof lockDockAnchor === "function") lockDockAnchor(side);
      ensureLayout().setExpandLeft(false);

      // Dock expanded = function balls (not free PANEL)
      if (!open) {
        closeDockList();
        guardToggle(1000);
        d.setExpanded(false);
        return;
      }
      d.setExpanded(true);
      return;
    }

    isOpen = open;
    if (isOpen) {
      shellDockClosing = false;
      if (isMobile && typeof prepareMobileOpen === "function") prepareMobileOpen();
      else if (typeof updateExpandDirection === "function") updateExpandDirection();
    } else {
      ensureLayout().setExpandLeft(false);
    }
    shellSync();

    if (!isOpen) {
      if (isListOpen) {
        isListOpen = false;
        closeListAnimated();
      } else {
        isListOpen = false;
        shellListClosing = false;
        ensureLayout().setListUp(false);
        shellSync();
      }
    }
  }


  function updateListDirection() {
    ensureLayout().updateListDirection();
  }

  function closeListAnimated() {
    if (!root) return;
    const list = $("#mp-list", root);
    if (list && isListOpen) {
      list.style.maxHeight = (getComputedStyle(root).getPropertyValue("--mp-list-h").trim() || "280px");
      void list.offsetHeight;
    }
    isListOpen = false;
    shellListClosing = true;
    shellSync();
    if (list) requestAnimationFrame(() => list.style.maxHeight = "0px");
    setTimeout(() => {
      if (!root) return;
      shellListClosing = false;
      if (!isListOpen) ensureLayout().setListUp(false);
      shellSync();
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
    const isLeft = lastDockSide === "left";

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
    if (!isMobile && (!root || !lastDockSide)) return;
    ensureDockListPanel();
    isDockListOpen = true;
    if (isMobile) setOpen(true);
    shellSync();
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
    shellSync();
    const panel = $("#mp-dock-list");
    if (panel) { panel.classList.remove("is-visible"); panel.setAttribute("aria-hidden", "true"); }
    const btn = $("#mp-dock-list-btn");
    if (btn) btn.classList.remove("active");
  }

  function toggleDockList() {
    if (!isMobile && (!root || !lastDockSide)) return toggleList();
    if (isDockListOpen) closeDockList(); else openDockList();
  }

  // 修改5：移动端点击列表按钮，自动路由到 toggleDockList
  function toggleList() {
    if (isMobile || lastDockSide) return toggleDockList();
    if (!isOpen && isMobile) setOpen(true);
    isListOpen = !isListOpen;
    if (root) {
      if (isListOpen) {
        shellListClosing = false;
        // Direction first so list-up class is present before is-list-open paints
        updateListDirection();
        updateExpandDirection();
        shellSync();
      } else {
        closeListAnimated();
      }
    }
  }

  function collapseToBall() {
    const wasListOpen = isListOpen;
    isListOpen = false;
    closeDockList();
    const near = typeof isNearDockEdge === "function" ? isNearDockEdge() : null;
    const docked = !!(lastDockSide || near);
    if (docked && isOpen) {
      guardToggle(1000);
      if (near && !lastDockSide) setDocked(near);
      setOpen(false);
    } else if (isOpen) {
      setOpen(false);
    } else {
      shellDockClosing = false;
      ensureLayout().setExpandLeft(false);
      shellSync();
    }
    if (wasListOpen) closeListAnimated();
    else {
      shellListClosing = false;
      ensureLayout().setListUp(false);
      shellSync();
    }
  }

  function onPlayerMouseLeave(e) {
    if (dragging) return;
    const related = e && e.relatedTarget;
    if (related && ((root && root.contains(related)) || (document.getElementById("mp-dock-list")?.contains(related)))) return;
    collapseToBall();
    shellNoHoverExpand = false;
    shellSync();
  }




  // =========================================================================
  // [Interaction:Gesture] inlined from src/interaction/Gesture.js
  // Owns: short/long press, click threshold, ghost-click guard, toggle intent
  // =========================================================================
  var gesture = null;
  var drag = null;

  // [Interaction:Drag] inlined from src/interaction/Drag.js
  function ensureDrag() {
    if (drag) return drag;
    drag = createDrag({
      getPosition: function () {
        return { x: posX, y: posY };
      },
      setPosition: function (x, y) {
        posX = x;
        posY = y;
        applyTransform();
      },
      clampPosition: function (x, y) {
        return clampPosition(x, y);
      },
      applyMagneticX: applyMagneticX,
      onDragBegin: function () {
        // UI collapse handled in Gesture onDragStart before begin()
      },
      onDragEnd: function () {
        // snap handled by endDragSession
      },
    });
    return drag;
  }

  function ensureGesture() {
    if (gesture) return gesture;
    gesture = createGesture(
      {
        longPressMs: CONFIG.longPressMs,
        clickThreshold: CONFIG.clickThreshold,
        longPressTapMax: 20,
      },
      {
        onToggle: function () {
          if (isMobile) toggleMobileBall();
          else togglePlay();
        },
        onLongPressTap: function (e) {
          var touch =
            (e && (e.pointerType === "touch" || e.pointerType === "pen")) ||
            isMobile ||
            window.innerWidth <= 600;
          if (!touch) return;
          if (window.Orbit && typeof window.Orbit.openLauncher === "function") {
            window.Orbit.openLauncher();
          }
        },
        onDragStart: function () {
          wasDragging = true;
          dragging = true;
          longPressTriggered = true;
          collapseToBall();
          setDocked(null);
          shellNoHoverExpand = true;
          shellSync();
          // Drag owns origin + position updates from here
          ensureDrag().begin({ x: posX, y: posY });
          originX = posX;
          originY = posY;
          var pid = gesture.getActivePointer();
          activePointer = pid;
          pointerId = pid;
          try {
            if (coverEl && pid != null) coverEl.setPointerCapture(pid);
          } catch (err) {}
        },
        isBlocked: function () {
          return !!shellDockClosing || Date.now() < ignoreBallToggleUntil;
        },
      }
    );
    return gesture;
  }

  /** Keep document-level ghost click guard in sync with Gesture */
  function guardToggle(ms) {
    ignoreBallToggleUntil = Math.max(ignoreBallToggleUntil || 0, Date.now() + (ms || 0));
    if (gesture) gesture.blockToggle(ms);
  }

  function endDragSession(commitSnap) {
    var g = ensureGesture();
    var d = ensureDrag();
    var pid = g.getActivePointer();
    if (moveRaf) { cancelAnimationFrame(moveRaf); moveRaf = 0; }
    pendingMove = null;
    document.removeEventListener("pointermove", onDocPointerMove);
    document.removeEventListener("pointerup", onDocPointerUp);
    document.removeEventListener("pointercancel", onDocPointerUp);
    if (pid != null && coverEl) {
      try {
        if (coverEl.hasPointerCapture && coverEl.hasPointerCapture(pid)) coverEl.releasePointerCapture(pid);
      } catch (err) {}
    }
    var wasDrag = wasDragging || dragging || g.isDragging() || d.isActive();
    g.cancel();
    d.end();
    dragging = false;
    longPressTriggered = false;
    activePointer = null;
    pointerId = null;
    longPressTimer = null;
    shellSync();
    if (wasDrag) {
      collapseToBall();
      shellNoHoverExpand = true;
      shellSync();
      if (commitSnap) snapToEdge();
    }
    wasDragging = false;
    return wasDrag;
  }

  // [Interaction:Gesture + Drag] pointer session on cover — Gesture owns press/toggle
  function onCoverPointerDown(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (!coverEl || (e.target !== coverEl && !coverEl.contains(e.target))) return;
    var g = ensureGesture();
    if (g.getActivePointer() != null) return;

    ensureSnap().clearMagnet();
    magnetSide = null;
    shellMagnet = false;
    shellMagnetSide = null;
    shellSnapping = false;
    wasDragging = false;
    dragging = false;
    longPressTriggered = false;
    shellSync();

    var start = g.onPointerDown(e);
    if (!start) return;
    startClientX = start.startClientX;
    startClientY = start.startClientY;
    originX = posX;
    originY = posY;
    activePointer = g.getActivePointer();
    pointerId = activePointer;
    moveDist = 0;

    document.addEventListener("pointermove", onDocPointerMove, { passive: false });
    document.addEventListener("pointerup", onDocPointerUp, { passive: false });
    document.addEventListener("pointercancel", onDocPointerUp, { passive: false });
  }

  var moveRaf = 0;
  var pendingMove = null;
  function flushPointerMove() {
    moveRaf = 0;
    var e = pendingMove;
    pendingMove = null;
    if (!e) return;
    onDocPointerMoveNow(e);
  }
  function onDocPointerMove(e) {
    pendingMove = e;
    if (!moveRaf) {
      moveRaf = requestAnimationFrame(flushPointerMove);
    }
  }
  function onDocPointerMoveNow(e) {
    var g = ensureGesture();
    var d = ensureDrag();
    if (e.pointerType === "mouse" && e.buttons === 0) {
      return endDragSession(wasDragging || dragging || g.isDragging() || d.isActive());
    }
    var phase = g.onPointerMove(e);
    if (phase === "ignore") return;

    if (g.isDragging()) {
      dragging = true;
      wasDragging = true;
    }
    var start = g.getStart();
    startClientX = start.x;
    startClientY = start.y;
    moveDist = g.getMoveDist();
    activePointer = g.getActivePointer();

    if (!g.isDragging() && !d.isActive()) return;
    e.preventDefault();
    // Drag owns delta → position (+ magnetic via applyMagneticX session)
    if (!d.isActive()) {
      d.begin({ x: posX, y: posY });
      originX = posX;
      originY = posY;
    }
    var dx = e.clientX - startClientX;
    var dy = e.clientY - startClientY;
    d.move(dx, dy, e.clientX, { startClientX: startClientX, x: startClientX });
    var o = d.getOrigin();
    originX = o.x;
    originY = o.y;
  }

  // 短按 → Gesture.onToggle；长按/滑动 → Drag（onDragStart 已处理）
  function onDocPointerUp(e) {
    var g = ensureGesture();
    var pid = g.getActivePointer();
    if (pid == null || e.pointerId !== pid) return;

    var wasDrag = wasDragging || dragging || g.isDragging();
    // Gesture cancel is inside endDragSession — resolve tap/long-press first
    if (!wasDrag) {
      g.onPointerUp(e, { wasDragging: false, pointerId: pid });
    }
    endDragSession(true);

    try {
      e.preventDefault();
      e.stopPropagation();
    } catch (err) {}
  }


  /**
   * M1: every listener is NAMED and registered into `lifecycle` so that
   * destroy() releases it in reverse order. No window.* global flags —
   * ghost-click blocker state is module-scoped and reset on destroy.
   */
  function onDocGhostClick(e) {
    var blocked =
      Date.now() < ignoreBallToggleUntil ||
      (gesture && Date.now() < gesture.getIgnoreUntil());
    if (blocked) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function onCoverClickGuard(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function bindEvents() {
    if (!coverEl || eventsBound) return;
    eventsBound = true;
    const lc = lifecycle;
    const track = (target, type, fn, opts) => {
      if (!target) return;
      target.addEventListener(type, fn, opts);
      lc.add(() => {
        try { target.removeEventListener(type, fn, opts); } catch (err) {}
      });
    };

    track(coverEl, "pointerdown", onCoverPointerDown);

    // 文档捕获阶段吞掉关闭后的合成 click；每轮启动只绑定一次，
    // destroy 会经 lifecycle 移除并复位 ghostClickBlockerBound。
    if (!ghostClickBlockerBound) {
      ghostClickBlockerBound = true;
      track(document, "click", onDocGhostClick, true);
    }

    // 屏蔽 touch 后的合成 click，避免关闭 Dock 后又触发一次打开
    track(coverEl, "click", onCoverClickGuard);

    track(root, "mouseleave", onPlayerMouseLeave);
    const onRootEnter = () => {
      if (!isMobile) updateExpandDirection();
    };
    track(root, "mouseenter", onRootEnter);

    const dockPanel = ensureDockListPanel();
    const onDockLeave = (e) => {
      const related = e.relatedTarget;
      if (related && ((root && root.contains(related)) || (dockPanel && dockPanel.contains(related)))) return;
      onPlayerMouseLeave(e);
    };
    track(dockPanel, "mouseleave", onDockLeave);

    // Phase 2: prefer Template refs; fall back to query for safety
    const r = refs || Template.bindRefs(root);
    const bindEl = (el, fn) => {
      if (!el) return;
      const handler = (e) => { e.stopPropagation(); fn(e); };
      track(el, "click", handler);
    };

    bindEl(r.playBtn, () => togglePlay());
    bindEl(r.dockPlay, () => togglePlay());
    bindEl(r.prevBtn, () => playPrev());
    bindEl(r.nextBtn, () => playNext(true));
    bindEl(r.listBtn, () => toggleList());
    bindEl(r.loopBtn, () => toggleLoop());
    bindEl(r.dockPrev, () => playPrev());
    bindEl(r.dockNext, () => playNext(true));
    bindEl(r.dockLoop, () => toggleLoop());
    bindEl(r.dockListBtn, () => toggleDockList());

    const onProgressClick = (e) => {
      e.stopPropagation();
      var pr = r.progress.getBoundingClientRect();
      seek((e.clientX - pr.left) / (pr.width || 1));
    };
    track(r.progress, "click", onProgressClick);

    const onListItemClick = (e) => {
      const item = e.target.closest(".mp-list-item"); if (!item) return;
      const idx = parseInt(item.dataset.index, 10); if (isNaN(idx)) return;
      loadSong(idx, true);
      if (isDockListOpen && isMobile) closeDockList();
    };
    track(r.listInner, "click", onListItemClick);
    track(r.dockListInner, "click", onListItemClick);

    const onOutsideDockList = (e) => {
      if (!isDockListOpen) return;
      const panel = r.dockSheet;
      const dockBtn = r.dockListBtn;
      if ((panel && panel.contains(e.target)) || (dockBtn && dockBtn.contains(e.target)) || (root && root.contains(e.target))) return;
      closeDockList();
    };
    track(document, "pointerdown", onOutsideDockList, { passive: true });

    const onOutsideCollapse = (e) => {
      if (!isMobile || (!isOpen && !isListOpen)) return;
      if (root && !root.contains(e.target)) {
        const dockList = r.dockSheet;
        if (dockList && dockList.contains(e.target)) return;
        collapseToBall();
      }
    };
    track(document, "pointerdown", onOutsideCollapse, { passive: true });

    const onWindowResize = () => {
      // 当发生旋转等行为时重新更新 mobile 标志
      isMobile = window.innerWidth <= 600;
      const [nx, ny] = clampPosition(posX, posY);
      posX = nx; posY = ny; applyTransform(); syncDockFromPosition(); if (isDockListOpen) positionDockList();
      shellSync();
    };
    track(window, "resize", onWindowResize);

    track(window, "beforeunload", onBeforeUnload);
  }

  let initialized = false, eventsBound = false;
  let lifecycle = null;
  let bodyObserver = null;
  let ownedPortals = [];
  let onPjaxComplete = null;
  // M1: module-scoped boot/revival guards (no window.* globals)
  let bootTimer = null;
  let alive = false;
  let ghostClickBlockerBound = false;
  /** @type {AbortController | null} M4: cancels in-flight playlist fetch on destroy */
  let fetchController = null;
  function onBeforeUnload() { persistNow(); }
  function claimOwnedPortal(el) {
    if (el && ownedPortals.indexOf(el) < 0) ownedPortals.push(el);
  }
  function releaseOwnedPortals() {
    for (var i = 0; i < ownedPortals.length; i++) {
      var el = ownedPortals[i];
      try { if (el && el.parentNode) el.parentNode.removeChild(el); } catch (err) {}
    }
    ownedPortals = [];
  }

  /** @type {ReturnType<typeof Template.bindRefs> | null} */
  let refs = null;

  function cacheDOMRefs() {
    // Phase 2: all shell queries go through Template.bindRefs
    refs = Template.bindRefs(root);
    coverEl = refs.cover;
    titleEl = refs.title;
    artistEl = refs.artist;
    playedEl = refs.played;
    timeEl = refs.time;
    listInner = refs.listInner;
    playBtnIcon = refs.playBtnIcon;
    dockPlayBtnIcon = refs.dockPlayIcon;
  }

  function ensureVisibleOnScreen() {
    if (!root) return;
    if (root.classList && root.classList.contains("orbit-hidden")) return;
    root.style.cssText += ";display:block;visibility:visible;opacity:1;pointer-events:auto;z-index:99999;";
    const fix = () => {
      if (!root) return; // M1: never touch a destroyed root
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
    if (!document.body) {
      bootTimer = setTimeout(init, 50); // M1: cancellable via destroy()
      return;
    }
    if (!lifecycle || lifecycle.disposed) {
      lifecycle = createLifecycleScope();
    }
    isMobile = window.innerWidth <= 600;
    loadPersisted();
    // Phase 2: mount shell via Template
    const mounted = Template.mount(document.body);
    root = mounted.root;
    alive = true; // M1: revival guards (pjax / observer) may act again
    cacheDOMRefs();
    if (!coverEl) return;
    shellSync(); // Phase 1: initial class projection
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
      fetchController = new AbortController();
      playlist = await fetchPlaylist(fetchController.signal);
      if (!alive) return; // M4 fix: destroyed while fetching — never revive
      renderList();
      const s = getState();
      if (s.index != null && s.index < playlist.length) currentIndex = s.index;
      loadSong(currentIndex, false);
      if (s.time && audio) {
        // M1: named handler, registered in lifecycle, removed on destroy
        const onLoadedMetaSeek = () => {
          if (audio && audio.readyState >= 1) {
            try { audio.currentTime = s.time; } catch (err) {}
            updateProgress();
            try { audio.removeEventListener("loadedmetadata", onLoadedMetaSeek); } catch (err) {}
          }
        };
        audio.addEventListener("loadedmetadata", onLoadedMetaSeek);
        if (lifecycle) {
          lifecycle.add(() => {
            try { if (audio) audio.removeEventListener("loadedmetadata", onLoadedMetaSeek); } catch (err) {}
          });
        }
      }
    } catch (err) {
      if (!alive) return; // M4 fix: aborted by destroy — do not touch DOM
      if (titleEl) titleEl.textContent = "加载失败"; if (artistEl) artistEl.textContent = "请检查网络或 API";
      if (listInner) listInner.innerHTML = '<div class="mp-empty">歌单加载失败</div>';
    }

    if (bodyObserver) {
      try { bodyObserver.disconnect(); } catch (e) {}
      bodyObserver = null;
    }
    bodyObserver = new MutationObserver(() => {
      if (!alive) return; // M1: destroyed — never revive
      if (lifecycle && lifecycle.disposed) return;
      const existing = document.getElementById("music-player");
      if (!existing || !document.body.contains(existing)) {
        if (root) { document.body.appendChild(root); ensureVisibleOnScreen(); }
        else init();
      }
    });
    bodyObserver.observe(document.body, { childList: true });
  }

  function boot() {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
    else init();
    if (!onPjaxComplete) {
      onPjaxComplete = function () {
        setTimeout(function () {
          if (!alive) return; // M1: destroyed — never revive
          if (!document.getElementById("music-player")) {
            initialized = false;
            eventsBound = false;
            init();
          } else ensureVisibleOnScreen();
        }, 30);
      };
      document.addEventListener("pjax:complete", onPjaxComplete);
    }
  }

  /**
   * Phase 3 + M1 — destroy (idempotent). Cleans audio, observer, owned portals,
   * root, ALL lifecycle-registered listeners (reverse order), pending timers /
   * rAF / gesture state, and module-scoped flags. No detached-root revival.
   * Does not remove foreign #mp-dock-list nodes we did not create.
   */
  function destroyMusicPlayer() {
    alive = false;
    if (bootTimer) { clearTimeout(bootTimer); bootTimer = null; }
    if (moveRaf) { cancelAnimationFrame(moveRaf); moveRaf = 0; }
    pendingMove = null;
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    ignoreBallToggleUntil = 0;
    ghostClickBlockerBound = false;

    // M4 fix: cancel in-flight playlist fetch so its resolution can never
    // render/load audio into a destroyed instance.
    if (fetchController) {
      try { fetchController.abort(); } catch (e) {}
      fetchController = null;
    }

    // M4 fix: terminate any active pointer session (drag-in-flight destroy)
    // so document-level listeners and pointer capture are released.
    try {
      if (gesture) {
        const pid = gesture.getActivePointer();
        if (pid != null && coverEl) {
          try {
            if (coverEl.hasPointerCapture && coverEl.hasPointerCapture(pid)) {
              coverEl.releasePointerCapture(pid);
            }
          } catch (err) {}
        }
        gesture.cancel();
      }
    } catch (e) {}
    try {
      document.removeEventListener("pointermove", onDocPointerMove);
      document.removeEventListener("pointerup", onDocPointerUp);
      document.removeEventListener("pointercancel", onDocPointerUp);
    } catch (e) {}

    try {
      if (musicEngine && typeof musicEngine.destroy === "function") musicEngine.destroy();
    } catch (e) {}
    musicEngine = null;
    audio = null;

    if (bodyObserver) {
      try { bodyObserver.disconnect(); } catch (e) {}
      bodyObserver = null;
    }

    if (onPjaxComplete) {
      try { document.removeEventListener("pjax:complete", onPjaxComplete); } catch (e) {}
      onPjaxComplete = null;
    }

    releaseOwnedPortals();

    if (root && root.parentNode) {
      try { root.parentNode.removeChild(root); } catch (e) {}
    }
    var stray = document.getElementById("music-player");
    if (stray && stray.parentNode) {
      try { stray.parentNode.removeChild(stray); } catch (e) {}
    }

    if (lifecycle && !lifecycle.disposed) {
      try { lifecycle.dispose(); } catch (e) {}
    }
    lifecycle = null;

    root = null;
    coverEl = null;
    refs = null;

    // M1: reset lazy singletons + shell/gesture residue so remount starts clean
    snap = null;
    dockCtl = null;
    layoutCtl = null;
    gesture = null;
    drag = null;
    magnetSide = null;
    lastDockSide = null;
    dockAnchorX = null;
    dockAnchorY = null;
    shellSnapping = false;
    shellDockClosing = false;
    shellNoHoverExpand = false;
    shellExpandLeft = false;
    shellListClosing = false;
    shellListUp = false;
    shellDockDown = false;
    shellMagnet = false;
    shellMagnetSide = null;

    initialized = false;
    eventsBound = false;
    isOpen = false;
    isListOpen = false;
    isDockListOpen = false;
    playlist = [];
  }

/** 启动播放器（打包后会自动调用） */function startMusicPlayer() {
  boot();
  if (typeof window !== "undefined") {
    window.__FWF_MUSIC_API__ = {
      start: startMusicPlayer,
      destroy: destroyMusicPlayer,
    };
  }
}function destroyMusicPlayerExport() {
  destroyMusicPlayer();
}

/**
 * M3 — Music as a Contract widget definition (MINIMAL adapter layer).
 * The business shell (shellSync / dock / playlist / audio) stays untouched;
 * this only wraps start/destroy/portal reporting so the Runtime and Launcher
 * can drive Music through the same register/mount/destroy/visibility path as
 * any other Contract widget. Full Contract refactor is v0.5 scope.
 */const musicWidgetDefinition = {
  id: "music",
  version: "0.4",
  label: "Music 音乐",
  capabilities: {
    launcher: true,
    portal: true,
  },
  mount: function () {
    startMusicPlayer();
    // M4 fix: remember the root reference created by this mount so the
    // Runtime's body-recovery can re-attach it after a PJAX body swap
    // (a live getElementById() query would return null once detached).
    const rootRef = document.getElementById("music-player");
    return {
      get root() {
        return document.getElementById("music-player") || rootRef;
      },
      portals: function () {
        const nodes = [];
        // in-memory claimed portals first — they survive body swaps
        for (let i = 0; i < ownedPortals.length; i++) {
          if (ownedPortals[i] && nodes.indexOf(ownedPortals[i]) < 0) {
            nodes.push(ownedPortals[i]);
          }
        }
        const marked = document.querySelectorAll(
          '[data-orbit-portal="music-dock-list"]'
        );
        for (let i = 0; i < marked.length; i++) {
          if (nodes.indexOf(marked[i]) < 0) nodes.push(marked[i]);
        }
        const sheet = document.getElementById("mp-dock-list");
        if (sheet && nodes.indexOf(sheet) < 0) nodes.push(sheet);
        return nodes;
      },
      destroy: destroyMusicPlayer,
    };
  },
};__mod.boot = boot;
__mod.init = init;
__mod.destroyMusicPlayer = destroyMusicPlayer;

if (typeof startMusicPlayer !== 'undefined') __mod.startMusicPlayer = startMusicPlayer;
if (typeof destroyMusicPlayerExport !== 'undefined') __mod.destroyMusicPlayerExport = destroyMusicPlayerExport;
if (typeof musicWidgetDefinition !== 'undefined') __mod.musicWidgetDefinition = musicWidgetDefinition;
if (typeof boot !== 'undefined') __mod.boot = boot;
if (typeof init !== 'undefined') __mod.init = init;
if (typeof destroyMusicPlayer !== 'undefined') __mod.destroyMusicPlayer = destroyMusicPlayer;

};

/* ---- src/widgets/clock/ClockWidget.js ---- */
__modules["src/widgets/clock/ClockWidget.js"] = function (__mod, __require) {
var __dep0 = __require("src/core/WidgetRegistry.js");
var registerWidget = __dep0.registerWidget;
/**
 * FWF Clock Widget — second official widget (Phase 5)
 *
 * Proves the Shell is not Music-only: same spatial interaction language,
 * different content (time display).
 */
/**
 * Format helpers
 */
function pad(n) {
  return n < 10 ? "0" + n : String(n);
}

function formatTime(d, withSeconds) {
  const h = pad(d.getHours());
  const m = pad(d.getMinutes());
  if (!withSeconds) return h + ":" + m;
  return h + ":" + m + ":" + pad(d.getSeconds());
}

function formatDate(d) {
  const y = d.getFullYear();
  const mo = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const week = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
  return y + "-" + mo + "-" + day + " 周" + week;
}

/**
 * @param {object} ctx
 * @param {HTMLElement} ctx.root — floating root
 * @param {object} [ctx.refs] — { face, panel, dateEl, fullTimeEl }
 * @param {{ intervalMs?: number, showSeconds?: boolean }} [ctx.options]
 */function mount(ctx) {
  const root = ctx && ctx.root;
  const refs = (ctx && ctx.refs) || {};
  const options = (ctx && ctx.options) || {};
  const intervalMs = options.intervalMs != null ? options.intervalMs : 1000;
  const showSeconds = !!options.showSeconds;

  let timer = null;

  function tick() {
    const now = new Date();
    const t = formatTime(now, showSeconds);
    if (refs.face) refs.face.textContent = t;
    if (refs.fullTimeEl) refs.fullTimeEl.textContent = formatTime(now, true);
    if (refs.dateEl) refs.dateEl.textContent = formatDate(now);
    if (root) root.setAttribute("data-time", t);
  }

  function start() {
    stop();
    tick();
    timer = setInterval(tick, intervalMs);
  }

  function stop() {
    if (timer != null) {
      clearInterval(timer);
      timer = null;
    }
  }

  function destroy() {
    stop();
  }

  start();

  return {
    id: "clock",
    tick: tick,
    start: start,
    stop: stop,
    destroy: destroy,
  };
}

registerWidget("clock", { mount: mount });


if (typeof mount !== 'undefined') __mod.mount = mount;

};

/* ---- src/host/clock-host.js ---- */
__modules["src/host/clock-host.js"] = function (__mod, __require) {
var __dep0 = __require("src/interaction/Gesture.js");
var createGesture = __dep0.createGesture;
var __dep1 = __require("src/interaction/Drag.js");
var createDrag = __dep1.createDrag;
var __dep2 = __require("src/interaction/Snap.js");
var createSnap = __dep2.createSnap;
var __dep3 = __require("src/interaction/ExpandPolicy.js");
var resolveExpandDirection = __dep3.resolveExpandDirection;
var expandDownTranslateY = __dep3.expandDownTranslateY;
var __dep4 = __require("src/widgets/clock/ClockWidget.js");
var mount = __dep4.mount;
var __dep5 = __require("src/core/LifecycleScope.js");
var createLifecycleScope = __dep5.createLifecycleScope;
/**
 * FWF Clock Host — minimal floating shell + Clock widget
 * Reuses Gesture / Drag / Snap (same interaction language as Music).
 */
const CONFIG = {
  storageKey: "fwf-clock-pos-v1",
  snapThreshold: 40,
  snapRelease: 36,
  snapThresholdMobile: 28,
  snapReleaseMobile: 28,
  longPressMs: 550,
  clickThreshold: 12,
  ballSize: 72,
  ballSizeMobile: 56,
  panelWidth: 200,
  panelHeight: 84,
};

let root = null;
let faceEl = null;
let panelEl = null;
let dateEl = null;
let fullTimeEl = null;

let posX = 0;
let posY = 0;
let isOpen = false;
let isMobile = false;
let dragging = false;
let wasDragging = false;
let lastDockSide = null;
let originX = 0;
let originY = 0;
let startClientX = 0;
let startClientY = 0;
let expandLeft = false;
let expandDown = false;

let gesture = null;
let drag = null;
let snap = null;
let clockApi = null;
let eventsBound = false;
let lifecycle = null;
let booted = false;
/** @type {object|null} M3: Contract ctx (standalone mode gets a local one) */
let ctx = null;

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function loadPos() {
  let s = null;
  // M3: Contract mode reads ctx.profile (orbit-profile:clock);
  // standalone keeps the legacy key, one-time migration reads it as fallback.
  if (ctx && ctx.profile) {
    try { s = ctx.profile.get(); } catch (e) { s = null; }
  }
  if (!s) {
    try {
      s = JSON.parse(localStorage.getItem(CONFIG.storageKey) || "null");
    } catch (e) {
      s = null;
    }
  }
  if (s && s.x != null && s.y != null) {
    posX = s.x;
    posY = s.y;
  }
}

function savePos() {
  const data = { x: posX, y: posY };
  if (ctx && ctx.profile) {
    try { ctx.profile.set(data); } catch (e) {}
  } else {
    try { localStorage.setItem(CONFIG.storageKey, JSON.stringify(data)); } catch (e) {}
  }
}

function ballSizeNow() {
  return isMobile || window.innerWidth <= 600
    ? CONFIG.ballSizeMobile
    : CONFIG.ballSize;
}

/**
 * bottom 锚定的元素增高默认往上长；expand-down 时由 ExpandPolicy 给出 Y 补偿。
 */
function applyTransform() {
  if (!root) return;
  var y =
    posY +
    expandDownTranslateY(
      isOpen,
      expandDown,
      ballSizeNow(),
      CONFIG.panelHeight
    );
  root.style.transform = "translate(" + posX + "px," + y + "px)";
}

function clampPosition(x, y) {
  if (!root) return [x, y];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = isOpen ? CONFIG.panelWidth : root.offsetWidth || CONFIG.ballSize;
  const h = root.offsetHeight || CONFIG.ballSize;
  const style = getComputedStyle(root);
  const leftBase = parseFloat(style.left) || 20;
  const bottomBase = parseFloat(style.bottom) || 20;
  const margin = 8;
  const minX = margin - leftBase;
  const maxX = vw - w - margin - leftBase;
  const minY = -(vh - h - margin - bottomBase);
  const maxY = margin - bottomBase;
  return [clamp(x, minX, maxX), clamp(y, minY, maxY)];
}

/**
 * Host only measures geometry + applies classes.
 * Decision lives in ExpandPolicy (shared by any Widget).
 */
function updateExpandDirection(force) {
  // 展开期间锁定方向，避免测量反馈导致抽搐
  if (isOpen && !force) return;
  if (!root || dragging) {
    expandLeft = false;
    expandDown = false;
    root.classList.remove("expand-left", "expand-down");
    return;
  }

  const rect = root.getBoundingClientRect();
  const ballH = ballSizeNow();
  const ballW = ballH; // clock ball is square
  // When already open, recover approximate ball top for stable policy input
  var absTop;
  if (isOpen) {
    absTop = expandDown ? rect.top : rect.bottom - ballH;
  } else {
    absTop = rect.top;
  }
  var absLeft = rect.left;
  // When open + expand-left, rect.left is panel left; ball left ≈ rect.right - ballW
  if (isOpen && expandLeft) {
    absLeft = rect.right - ballW;
  }

  const result = resolveExpandDirection({
    absLeft: absLeft,
    absTop: absTop,
    ballW: ballW,
    ballH: ballH,
    openW: CONFIG.panelWidth,
    openH: CONFIG.panelHeight,
    viewportW: window.innerWidth,
    viewportH: window.innerHeight,
    dockSide: lastDockSide,
    pad: 12,
  });

  expandLeft = result.expandLeft;
  expandDown = result.expandDown;
  root.classList.toggle("expand-left", expandLeft);
  root.classList.toggle("expand-down", expandDown);
}

function ensureSnap() {
  if (snap) return snap;
  snap = createSnap(
    {
      snapThreshold: CONFIG.snapThreshold,
      snapRelease: CONFIG.snapRelease,
      snapThresholdMobile: CONFIG.snapThresholdMobile,
      snapReleaseMobile: CONFIG.snapReleaseMobile,
      ballSize: CONFIG.ballSize,
      ballSizeMobile: CONFIG.ballSizeMobile,
    },
    {
      isMobile: function () {
        return isMobile || window.innerWidth <= 600;
      },
      getRoot: function () {
        return root;
      },
      getPosX: function () {
        return posX;
      },
      getPosY: function () {
        return posY;
      },
      setPosition: function (x, y) {
        posX = x;
        posY = y;
        applyTransform();
      },
      clampPosition: clampPosition,
      onSnapSide: function (side) {
        lastDockSide = side;
        if (root) {
          root.classList.toggle("is-docked", !!side);
          root.classList.toggle("dock-left", side === "left");
          root.classList.toggle("dock-right", side === "right");
        }
        savePos();
      },
      onSnappingStart: function () {
        if (root) root.classList.add("is-snapping");
      },
      onSnappingEnd: function () {
        if (root) root.classList.remove("is-snapping");
      },
      onMagnetChange: function (side) {
        if (!root) return;
        if (side) {
          root.classList.add("is-magnet");
          root.classList.toggle("magnet-left", side === "left");
          root.classList.toggle("magnet-right", side === "right");
        } else {
          root.classList.remove("is-magnet", "magnet-left", "magnet-right");
        }
      },
    }
  );
  return snap;
}

function ensureDrag() {
  if (drag) return drag;
  drag = createDrag({
    getPosition: function () {
      return { x: posX, y: posY };
    },
    setPosition: function (x, y) {
      posX = x;
      posY = y;
      applyTransform();
    },
    clampPosition: clampPosition,
    applyMagneticX: function (freeX, clientX, session) {
      return ensureSnap().applyMagneticX(freeX, clientX, session);
    },
  });
  return drag;
}

function setOpen(open) {
  open = !!open;
  if (!root) {
    isOpen = open;
    return;
  }
  if (open === isOpen) return;

  if (open) {
    updateExpandDirection(true);
    // 方向 class 先于 is-open，减少闪一帧错误方向
    root.classList.toggle("expand-left", expandLeft);
    root.classList.toggle("expand-down", expandDown);
    isOpen = true;
    root.classList.add("is-open");
    applyTransform();
  } else {
    isOpen = false;
    root.classList.remove("is-open");
    applyTransform();
    window.setTimeout(function () {
      if (!isOpen && root) {
        root.classList.remove("expand-left", "expand-down");
        expandLeft = false;
        expandDown = false;
      }
    }, 320);
  }
}

function ensureGesture() {
  if (gesture) return gesture;
  gesture = createGesture(
    {
      longPressMs: CONFIG.longPressMs,
      clickThreshold: CONFIG.clickThreshold,
      longPressTapMax: 20,
    },
    {
      onToggle: function () {
        // Desktop: hover open/close. Mobile: tap toggle.
        if (!isMobile) return;
        setOpen(!isOpen);
      },
      onLongPressTap: function (e) {
        // Mobile / touch: long-press stay → Orbit launcher
        var touch =
          (e && (e.pointerType === "touch" || e.pointerType === "pen")) ||
          isMobile ||
          window.innerWidth <= 600;
        if (!touch) return;
        if (window.Orbit && typeof window.Orbit.openLauncher === "function") {
          window.Orbit.openLauncher();
        }
      },
      onDragStart: function () {
        wasDragging = true;
        dragging = true;
        setOpen(false);
        // keep lastDockSide until snap decides; clear visual dock while free-dragging
        if (root) {
          root.classList.add("is-dragging");
          root.classList.remove(
            "is-docked",
            "dock-left",
            "dock-right",
            "expand-left",
            "expand-down"
          );
        }
        lastDockSide = null;
        expandLeft = false;
        expandDown = false;
        ensureDrag().begin({ x: posX, y: posY });
        originX = posX;
        originY = posY;
        const pid = gesture.getActivePointer();
        try {
          if (root && pid != null) root.setPointerCapture(pid);
        } catch (e) {}
      },
      isBlocked: function () {
        return false;
      },
    }
  );
  return gesture;
}

function createDOM() {
  let el = document.getElementById("fwf-clock");
  if (el) {
    if (!document.body.contains(el)) document.body.appendChild(el);
    return el;
  }
  el = document.createElement("div");
  el.id = "fwf-clock";
  el.className = "fwf-clock";
  el.style.cssText =
    "position:fixed;left:20px;bottom:20px;z-index:99998;display:block;visibility:visible;opacity:1;pointer-events:auto;box-sizing:border-box";
  el.innerHTML =
    '<div class="fwf-clock-face" id="fwf-clock-face">--:--</div>' +
    '<div class="fwf-clock-panel" id="fwf-clock-panel">' +
    '<div class="fwf-clock-full" id="fwf-clock-full">--:--:--</div>' +
    '<div class="fwf-clock-date" id="fwf-clock-date">—</div>' +
    "</div>";
  document.body.appendChild(el);
  return el;
}

function endDragSession(commitSnap) {
  const g = ensureGesture();
  const d = ensureDrag();
  const pid = g.getActivePointer();
  if (moveRaf) {
    cancelAnimationFrame(moveRaf);
    moveRaf = 0;
  }
  pendingMove = null;
  document.removeEventListener("pointermove", onMove);
  document.removeEventListener("pointerup", onUp);
  document.removeEventListener("pointercancel", onUp);
  if (pid != null && root) {
    try {
      if (root.hasPointerCapture && root.hasPointerCapture(pid)) {
        root.releasePointerCapture(pid);
      }
    } catch (e) {}
  }
  const wasDrag = wasDragging || dragging || g.isDragging() || d.isActive();
  g.cancel();
  d.end();
  dragging = false;
  if (root) root.classList.remove("is-dragging");
  if (wasDrag && commitSnap) ensureSnap().snapToEdge();
  wasDragging = false;
  return wasDrag;
}

function onDown(e) {
  if (e.pointerType === "mouse" && e.button !== 0) return;
  const g = ensureGesture();
  if (g.getActivePointer() != null) return;
  if (e.pointerType === "touch" || e.pointerType === "pen") {
    try {
      e.preventDefault();
    } catch (err) {}
  }
  ensureSnap().clearMagnet();
  wasDragging = false;
  dragging = false;
  const start = g.onPointerDown(e);
  if (!start) return;
  startClientX = start.startClientX;
  startClientY = start.startClientY;
  originX = posX;
  originY = posY;
  document.addEventListener("pointermove", onMove, { passive: false });
  document.addEventListener("pointerup", onUp, { passive: false });
  document.addEventListener("pointercancel", onUp, { passive: false });
}

let moveRaf = 0;
let pendingMove = null;
function flushMove() {
  moveRaf = 0;
  const e = pendingMove;
  pendingMove = null;
  if (!e) return;
  onMoveNow(e);
}
function onMove(e) {
  pendingMove = e;
  if (!moveRaf) moveRaf = requestAnimationFrame(flushMove);
}
function onMoveNow(e) {
  const g = ensureGesture();
  const d = ensureDrag();
  if (e.pointerType === "mouse" && e.buttons === 0) {
    return endDragSession(true);
  }
  const phase = g.onPointerMove(e);
  if (phase === "ignore") return;
  if (g.isDragging()) {
    dragging = true;
    wasDragging = true;
  }
  const start = g.getStart();
  startClientX = start.x;
  startClientY = start.y;
  if (!g.isDragging() && !d.isActive()) return;
  e.preventDefault();
  if (!d.isActive()) {
    d.begin({ x: posX, y: posY });
  }
  d.move(e.clientX - startClientX, e.clientY - startClientY, e.clientX, {
    startClientX: startClientX,
    x: startClientX,
  });
}

function onUp(e) {
  const g = ensureGesture();
  const pid = g.getActivePointer();
  if (pid == null || e.pointerId !== pid) return;
  const wasDrag = wasDragging || dragging || g.isDragging();
  // Must handle toggle / long-press-tap BEFORE endDragSession → cancel()
  if (!wasDrag) {
    g.onPointerUp(e, { wasDragging: false, pointerId: pid });
  }
  endDragSession(true);
  try {
    e.preventDefault();
    e.stopPropagation();
  } catch (err) {}
}

function onDocPointerDown(e) {
  // Mobile: tap outside to close. Desktop uses mouseleave.
  if (!isMobile) return;
  if (!isOpen || dragging) return;
  if (root && root.contains(e.target)) return;
  setOpen(false);
}

function onMouseEnter() {
  if (isMobile || dragging) return;
  setOpen(true);
}

function onMouseLeave(e) {
  if (isMobile || dragging) return;
  const related = e && e.relatedTarget;
  if (related && root && root.contains(related)) return;
  setOpen(false);
}

function onRootClick(e) {
  e.preventDefault();
  e.stopPropagation();
}

function onResize() {
  isMobile = window.innerWidth <= 600;
  const pair = clampPosition(posX, posY);
  posX = pair[0];
  posY = pair[1];
  applyTransform();
  if (isOpen) updateExpandDirection(true);
}

function bindEvents() {
  if (!root || eventsBound) return;
  eventsBound = true;
  root.addEventListener("pointerdown", onDown);
  root.addEventListener("click", onRootClick);
  root.addEventListener("mouseenter", onMouseEnter);
  root.addEventListener("mouseleave", onMouseLeave);
  document.addEventListener("pointerdown", onDocPointerDown, true);
  window.addEventListener("resize", onResize);

  if (lifecycle) {
    lifecycle.add(function () {
      if (!root) return;
      root.removeEventListener("pointerdown", onDown);
      root.removeEventListener("click", onRootClick);
      root.removeEventListener("mouseenter", onMouseEnter);
      root.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("pointerdown", onDocPointerDown, true);
      window.removeEventListener("resize", onResize);
      eventsBound = false;
    });
  }
}

function resetHostState() {
  root = null;
  faceEl = null;
  panelEl = null;
  dateEl = null;
  fullTimeEl = null;
  clockApi = null;
  gesture = null;
  drag = null;
  snap = null;
  eventsBound = false;
  dragging = false;
  wasDragging = false;
  isOpen = false;
  lastDockSide = null;
  expandLeft = false;
  expandDown = false;
  booted = false;
  ctx = null;
}

/**
 * WidgetInstance-style destroy (Phase 2). Idempotent.
 * M4 fix: also terminates any active pointer session so document-level
 * listeners and pointer capture are released on drag-in-flight destroy.
 */function destroyClockWidget() {
  if (moveRaf) {
    cancelAnimationFrame(moveRaf);
    moveRaf = 0;
  }
  pendingMove = null;
  try {
    if (gesture) gesture.cancel();
    if (drag) drag.end();
  } catch (e) {}
  try {
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    document.removeEventListener("pointercancel", onUp);
  } catch (e) {}

  if (lifecycle && !lifecycle.disposed) {
    // dispose is async but cleanups are sync — fire and clear
    lifecycle.dispose();
  }
  lifecycle = null;

  if (clockApi && typeof clockApi.destroy === "function") {
    try {
      clockApi.destroy();
    } catch (e) {}
  }
  clockApi = null;

  if (eventsBound && root) {
    try {
      root.removeEventListener("pointerdown", onDown);
      root.removeEventListener("click", onRootClick);
      root.removeEventListener("mouseenter", onMouseEnter);
      root.removeEventListener("mouseleave", onMouseLeave);
    } catch (e) {}
    try {
      document.removeEventListener("pointerdown", onDocPointerDown, true);
      window.removeEventListener("resize", onResize);
    } catch (e) {}
    eventsBound = false;
  }

  if (root && root.parentNode) {
    try {
      root.parentNode.removeChild(root);
    } catch (e) {}
  }
  // remove stray by id
  const stray = typeof document !== "undefined" && document.getElementById("fwf-clock");
  if (stray && stray.parentNode) {
    try {
      stray.parentNode.removeChild(stray);
    } catch (e) {}
  }

  resetHostState();
}

function init() {
  if (!document.body) {
    setTimeout(init, 50);
    return;
  }
  // Idempotent: already mounted
  if (root && document.body.contains(root) && clockApi) {
    return;
  }
  // After destroy, allow full remount
  if (root && !document.body.contains(root)) {
    resetHostState();
  }

  // M3: lifecycle comes from the Contract ctx (standalone supplies its own)
  lifecycle = ctx.lifecycle;
  isMobile = window.innerWidth <= 600;
  loadPos();
  root = createDOM();
  faceEl = document.getElementById("fwf-clock-face");
  panelEl = document.getElementById("fwf-clock-panel");
  dateEl = document.getElementById("fwf-clock-date");
  fullTimeEl = document.getElementById("fwf-clock-full");
  applyTransform();
  bindEvents();

  clockApi = mount({
    root: root,
    refs: {
      face: faceEl,
      panel: panelEl,
      dateEl: dateEl,
      fullTimeEl: fullTimeEl,
    },
    options: { intervalMs: 1000, showSeconds: false },
  });

  lifecycle.add(function () {
    if (clockApi && typeof clockApi.destroy === "function") {
      clockApi.destroy();
    }
    clockApi = null;
  });

  lifecycle.add(function () {
    if (root && root.parentNode) {
      root.parentNode.removeChild(root);
    }
    const stray = document.getElementById("fwf-clock");
    if (stray && stray.parentNode) stray.parentNode.removeChild(stray);
  });

  booted = true;
}

/**
 * M3: minimal ctx for standalone single-file mode (no Orbit Runtime).
 * Keeps the legacy storage key; visibility is a simple display toggle.
 */
function createStandaloneCtx() {
  const scope = createLifecycleScope();
  return {
    lifecycle: scope,
    visibility: {
      setVisible: function (el, visible) {
        if (!el) return;
        if (visible) {
          el.style.display = "";
          el.style.visibility = "";
          el.setAttribute("aria-hidden", "false");
        } else {
          el.style.display = "none";
          el.setAttribute("aria-hidden", "true");
        }
      },
    },
    profile: {
      get: function () {
        try {
          return JSON.parse(localStorage.getItem(CONFIG.storageKey) || "null");
        } catch (e) {
          return null;
        }
      },
      set: function (obj) {
        try {
          localStorage.setItem(CONFIG.storageKey, JSON.stringify(obj));
        } catch (e) {}
      },
      clear: function () {
        try {
          localStorage.removeItem(CONFIG.storageKey);
        } catch (e) {}
      },
    },
    portal: {
      claim: function () {},
      release: function () {},
      list: function () {
        return [];
      },
    },
    launcher: {
      open: function () {},
      close: function () {},
      toggle: function () {},
    },
  };
}

/**
 * Contract mount (M3): idempotent; uses ctx services.
 * @param {object} [ctxArg] — Contract ctx (Runtime-provided or standalone)
 */
function mountClock(ctxArg) {
  ctx = ctxArg || createStandaloneCtx();
  init();
  return getClockInstance();
}

/** Clock as a Contract widget definition (M3). */const clockWidgetDefinition = {
  id: "clock",
  version: "0.4",
  label: "Clock 时钟",
  capabilities: {
    launcher: true,
    profile: true,
    // draggable/dockable stay out of the v0.4 mandatory surface
  },
  mount: mountClock,
};

function boot() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
}function startClockWidget() {
  mountClock();
  if (typeof window !== "undefined") {
    window.__FWF_CLOCK__ = {
      start: startClockWidget,
      destroy: destroyClockWidget,
      getRoot: getClockRoot,
      getInstance: getClockInstance,
    };
  }
}

/** @returns {HTMLElement | null} */function getClockRoot() {
  return root;
}

/**
 * WidgetInstance shape for Orbit / tests
 * @returns {{ id: string, root: HTMLElement | null, setVisible?: Function, destroy: Function }}
 */function getClockInstance() {
  return {
    id: "clock",
    get root() {
      return root;
    },
    setVisible: function (visible) {
      if (ctx && ctx.visibility) ctx.visibility.setVisible(root, !!visible);
    },
    destroy: destroyClockWidget,
  };
}__mod.boot = boot;
__mod.init = init;
__mod.destroy = destroyClockWidget;

if (typeof destroyClockWidget !== 'undefined') __mod.destroyClockWidget = destroyClockWidget;
if (typeof startClockWidget !== 'undefined') __mod.startClockWidget = startClockWidget;
if (typeof getClockRoot !== 'undefined') __mod.getClockRoot = getClockRoot;
if (typeof getClockInstance !== 'undefined') __mod.getClockInstance = getClockInstance;
if (typeof clockWidgetDefinition !== 'undefined') __mod.clockWidgetDefinition = clockWidgetDefinition;
if (typeof boot !== 'undefined') __mod.boot = boot;
if (typeof init !== 'undefined') __mod.init = init;
if (typeof destroy !== 'undefined') __mod.destroy = destroy;

};

/* ---- src/widgets/notice/NoticeWidget.js ---- */
__modules["src/widgets/notice/NoticeWidget.js"] = function (__mod, __require) {
/**
 * Orbit Notice Widget — third official widget (M3)
 *
 * A collapsible site-notice card. Deliberately heterogeneous vs Music
 * (audio) and Clock (time): pure content + dismiss state, proving the
 * Contract does not bind the widget to any business domain.
 *
 * Uses Contract services:
 *   - ctx.lifecycle  — all listeners/cleanup registered here
 *   - ctx.profile    — remembers dismissal (per-widget namespace)
 *   - ctx.visibility — hide ≠ destroy (dismissed stays mounted, Runtime can re-show)
 *   - ctx.launcher   — available but not required
 *
 * Config (optional): window.ORBIT.notice = { title, text, position, top, right, bottom, left, offset, zIndex }
 *   - title / text: 公告标题与正文（配置优先于 profile）
 *   - position: 预设位置 top-left | top-right | top-center |
 *               bottom-left | bottom-right | bottom-center（默认 top-right）
 *   - top / right / bottom / left: 自定义边距（number 视为 px，或 CSS 长度字符串）；
 *     写出的边会覆盖预设对应边，并对轴使用 auto 清掉对边
 *   - offset: 预设四角时的统一边距（number → px），默认 20
 *   - zIndex: 可选，默认 99989
 *
 * Close (×) behavior: hides the card AND asks the Runtime to set the
 * instance's visibility to false — the Launcher switch flips to OFF and the
 * preference is persisted (orbit-visible-v1), so a later page load keeps the
 * notice closed until the user re-enables it from the Launcher.
 */

function readConfig() {
  if (typeof window === "undefined" || !window.ORBIT) return {};
  const n = window.ORBIT.notice;
  return n && typeof n === "object" ? n : {};
}

/** @param {unknown} v @returns {string | null} */
function cssLen(v) {
  if (typeof v === "number" && isFinite(v)) return v + "px";
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

/**
 * Resolve fixed-position insets from ORBIT.notice.
 * Config is站长意图：只读配置，不写回 profile。
 * @param {object} cfg
 * @returns {{ top: string, right: string, bottom: string, left: string, transform: string, zIndex: string }}
 */
function resolvePosition(cfg) {
  const offsetRaw = cfg.offset;
  const edge =
    typeof offsetRaw === "number" && isFinite(offsetRaw)
      ? offsetRaw + "px"
      : typeof offsetRaw === "string" && offsetRaw.trim()
        ? offsetRaw.trim()
        : "20px";

  const presets = {
    "top-left": {
      top: edge,
      left: edge,
      right: "auto",
      bottom: "auto",
      transform: "",
    },
    "top-right": {
      top: edge,
      right: edge,
      left: "auto",
      bottom: "auto",
      transform: "",
    },
    "top-center": {
      top: edge,
      left: "50%",
      right: "auto",
      bottom: "auto",
      transform: "translateX(-50%)",
    },
    "bottom-left": {
      bottom: edge,
      left: edge,
      top: "auto",
      right: "auto",
      transform: "",
    },
    "bottom-right": {
      bottom: edge,
      right: edge,
      top: "auto",
      left: "auto",
      transform: "",
    },
    "bottom-center": {
      bottom: edge,
      left: "50%",
      top: "auto",
      right: "auto",
      transform: "translateX(-50%)",
    },
  };

  const key =
    typeof cfg.position === "string" && presets[cfg.position]
      ? cfg.position
      : "top-right";
  const base = presets[key];

  let top = base.top;
  let right = base.right;
  let bottom = base.bottom;
  let left = base.left;
  let transform = base.transform;

  const t = cssLen(cfg.top);
  const r = cssLen(cfg.right);
  const b = cssLen(cfg.bottom);
  const l = cssLen(cfg.left);

  // Explicit edges override preset; clear the opposite side on that axis.
  if (t != null) {
    top = t;
    bottom = "auto";
  }
  if (b != null) {
    bottom = b;
    top = "auto";
  }
  if (l != null) {
    left = l;
    right = "auto";
    if (transform.indexOf("translateX") >= 0) transform = "";
  }
  if (r != null) {
    right = r;
    left = "auto";
    if (transform.indexOf("translateX") >= 0) transform = "";
  }

  let zIndex = "99989";
  if (typeof cfg.zIndex === "number" && isFinite(cfg.zIndex)) {
    zIndex = String(cfg.zIndex);
  } else if (typeof cfg.zIndex === "string" && cfg.zIndex.trim()) {
    zIndex = cfg.zIndex.trim();
  }

  return { top: top, right: right, bottom: bottom, left: left, transform: transform, zIndex: zIndex };
}
const noticeWidgetDefinition = {
  id: "notice",
  version: "0.4",
  label: "Notice 公告",
  // M4 fix: NOT default-on — the docs require listing notice in
  // ORBIT.widgets explicitly; defaultWidgets() respects this.
  defaultVisible: false,
  capabilities: {
    launcher: true,
    profile: true,
  },
  mount: function (ctx) {
    const cfg = readConfig();
    const saved = ctx.profile.get() || {};
    // Config is the author's intent and wins; profile text is only a
    // fallback for the previous message before any config existed.
    const title =
      typeof cfg.title === "string" && cfg.title ? cfg.title : "公告";
    const text =
      typeof cfg.text === "string" && cfg.text
        ? cfg.text
        : typeof saved.text === "string" && saved.text
          ? saved.text
          : "站点公告：欢迎使用 Orbit 悬浮组件。";

    const pos = resolvePosition(cfg);

    const root = document.createElement("div");
    root.id = "orbit-notice";
    root.className = "orbit-notice";
    root.setAttribute("role", "region");
    root.setAttribute("aria-label", "站点公告");
    root.style.cssText =
      "position:fixed;" +
      "top:" +
      pos.top +
      ";" +
      "right:" +
      pos.right +
      ";" +
      "bottom:" +
      pos.bottom +
      ";" +
      "left:" +
      pos.left +
      ";" +
      (pos.transform ? "transform:" + pos.transform + ";" : "") +
      "z-index:" +
      pos.zIndex +
      ";" +
      "width:min(280px,88vw);" +
      "border-radius:12px;background:#0f172a;color:#e2e8f0;" +
      "font:13px/1.6 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.28);" +
      "overflow:hidden;box-sizing:border-box";

    const head = document.createElement("div");
    head.className = "orbit-notice-head";
    head.style.cssText =
      "display:flex;align-items:center;justify-content:space-between;" +
      "padding:8px 12px;background:rgba(255,255,255,.06);font-weight:600";
    const titleEl = document.createElement("span");
    titleEl.className = "orbit-notice-title";
    titleEl.textContent = title; // textContent: config never becomes markup
    head.appendChild(titleEl);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "orbit-notice-close";
    closeBtn.setAttribute("aria-label", "关闭公告");
    closeBtn.textContent = "×";
    closeBtn.style.cssText =
      "border:0;background:transparent;color:inherit;cursor:pointer;" +
      "font:inherit;line-height:1;padding:2px 6px;border-radius:6px";
    head.appendChild(closeBtn);

    const body = document.createElement("div");
    body.className = "orbit-notice-body";
    body.style.cssText = "padding:10px 12px";
    body.textContent = text;

    root.appendChild(head);
    root.appendChild(body);
    document.body.appendChild(root);

    const onClose = function () {
      try {
        ctx.profile.set({ title: title, text: text, dismissed: true });
      } catch (e) {}
      // Ask the Runtime to hide us + flip the Launcher switch + persist the
      // preference. Falls back to direct DOM hiding for standalone use.
      if (ctx.instance && typeof ctx.instance.setVisible === "function") {
        ctx.instance.setVisible(false);
      } else {
        ctx.visibility.setVisible(root, false);
      }
    };
    ctx.lifecycle.add(function () {
      closeBtn.removeEventListener("click", onClose);
    });
    closeBtn.addEventListener("click", onClose);

    ctx.lifecycle.add(function () {
      if (root.parentNode) root.parentNode.removeChild(root);
    });

    return {
      root: root,
      setVisible: function (visible) {
        ctx.visibility.setVisible(root, !!visible);
      },
      destroy: function () {
        ctx.lifecycle.dispose();
      },
      snapshot: function () {
        return {
          title: title,
          text: text,
          position: {
            top: pos.top,
            right: pos.right,
            bottom: pos.bottom,
            left: pos.left,
          },
        };
      },
    };
  },
};

if (typeof noticeWidgetDefinition !== 'undefined') __mod.noticeWidgetDefinition = noticeWidgetDefinition;

};

/* ---- src/entry-orbit.js ---- */
__modules["src/entry-orbit.js"] = function (__mod, __require) {
var __dep0 = __require("src/core/Orbit.js");
var Orbit = __dep0.Orbit;
var __dep1 = __require("src/host/music-player-host.js");
var musicWidgetDefinition = __dep1.musicWidgetDefinition;
var __dep2 = __require("src/host/clock-host.js");
var clockWidgetDefinition = __dep2.clockWidgetDefinition;
var __dep3 = __require("src/widgets/notice/NoticeWidget.js");
var noticeWidgetDefinition = __dep3.noticeWidgetDefinition;
/**
 * Orbit Runtime entry — Phase 4 / M3
 * All widgets are Contract registrations (register → mount → destroy →
 * visibility → Profile); the Runtime has zero hardcoded widget ids.
 */




Orbit.register(musicWidgetDefinition);
Orbit.register(clockWidgetDefinition);
Orbit.register(noticeWidgetDefinition);

if (typeof window !== "undefined") {
  window.Orbit = Orbit;
  const boot = function () {
    Orbit.mount(
      typeof window.ORBIT === "object" && window.ORBIT ? window.ORBIT : {}
    );
  };
  // M2: wait for DOMContentLoaded even when defer scripts run at
  // readyState "interactive" — guarantees all register() calls from other
  // defer scripts (Contract widgets) ran before mount() reads ORBIT.widgets.
  if (document.readyState === "loading" || document.readyState === "interactive") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
}
__mod.Orbit = Orbit;

if (typeof Orbit !== 'undefined') __mod.Orbit = Orbit;

};

__require("src/entry-orbit.js");
})();
