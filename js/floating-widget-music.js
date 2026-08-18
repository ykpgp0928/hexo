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
 */
function createGesture(config, handlers) {
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
 */
function createDrag(ctx) {
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
 */
function createSnap(config, ctx) {
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
 */
function createDock(handlers) {
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
 */
function resolveExpandDirection(input) {
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
 */
function resolveDockStackDirection(input) {
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
 */
function expandDownTranslateY(isOpen, expandDown, ballH, openH) {
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
 */
function createLayout(ctx) {
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
 */
function createAudioEngine(handlers) {
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
 */
function createLifecycleScope() {
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


  function bindEvents() {
    if (!coverEl) return;
    coverEl.addEventListener("pointerdown", onCoverPointerDown);
    // 文档捕获阶段吞掉关闭后的合成 click（比只挡 cover 更稳）
    if (!window.__mpGhostClickBlocker) {
      window.__mpGhostClickBlocker = true;
      document.addEventListener("click", (e) => {
        var blocked =
          Date.now() < ignoreBallToggleUntil ||
          (gesture && Date.now() < gesture.getIgnoreUntil());
        if (blocked) {
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

    // Phase 2: prefer Template refs; fall back to query for safety
    const r = refs || Template.bindRefs(root);
    const bindEl = (el, fn) => {
      if (el) el.addEventListener("click", (e) => { e.stopPropagation(); fn(e); });
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

    if (r.progress) {
      r.progress.addEventListener("click", (e) => {
        e.stopPropagation();
        var pr = r.progress.getBoundingClientRect(); seek((e.clientX - pr.left) / (pr.width || 1));
      });
    }

    const onListItemClick = (e) => {
      const item = e.target.closest(".mp-list-item"); if (!item) return;
      const idx = parseInt(item.dataset.index, 10); if (isNaN(idx)) return;
      loadSong(idx, true);
      if (isDockListOpen && isMobile) closeDockList();
    };
    if (r.listInner) r.listInner.addEventListener("click", onListItemClick);
    if (r.dockListInner) r.dockListInner.addEventListener("click", onListItemClick);

    document.addEventListener("pointerdown", (e) => {
      if (!isDockListOpen) return;
      const panel = r.dockSheet;
      const dockBtn = r.dockListBtn;
      if ((panel && panel.contains(e.target)) || (dockBtn && dockBtn.contains(e.target)) || (root && root.contains(e.target))) return;
      closeDockList();
    }, { passive: true });

    document.addEventListener("pointerdown", (e) => {
      if (!isMobile || (!isOpen && !isListOpen)) return;
      if (root && !root.contains(e.target)) {
        const dockList = r.dockSheet;
        if (dockList && dockList.contains(e.target)) return;
        collapseToBall();
      }
    }, { passive: true });

    window.addEventListener("resize", () => {
      // 当发生旋转等行为时重新更新 mobile 标志
      isMobile = window.innerWidth <= 600;
      const [nx, ny] = clampPosition(posX, posY);
      posX = nx; posY = ny; applyTransform(); syncDockFromPosition(); if (isDockListOpen) positionDockList();
      shellSync();
    });
    window.addEventListener("beforeunload", persistNow);
  }

  let initialized = false, eventsBound = false;
  let lifecycle = null;
  let bodyObserver = null;
  let ownedPortals = [];
  let onPjaxComplete = null;
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
    if (!lifecycle || lifecycle.disposed) {
      lifecycle = createLifecycleScope();
    }
    isMobile = window.innerWidth <= 600;
    loadPersisted();
    // Phase 2: mount shell via Template
    const mounted = Template.mount(document.body);
    root = mounted.root;
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

    if (bodyObserver) {
      try { bodyObserver.disconnect(); } catch (e) {}
      bodyObserver = null;
    }
    bodyObserver = new MutationObserver(() => {
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
   * Phase 3 — destroy (idempotent). Cleans audio, observer, owned portals, root.
   * Does not remove foreign #mp-dock-list nodes we did not create.
   */
  function destroyMusicPlayer() {
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
    initialized = false;
    eventsBound = false;
    isOpen = false;
    isListOpen = false;
    isDockListOpen = false;
    playlist = [];
  }

/** 启动播放器（打包后会自动调用） */
function startMusicPlayer() {
  boot();
  if (typeof window !== "undefined") {
    window.__FWF_MUSIC_API__ = {
      start: startMusicPlayer,
      destroy: destroyMusicPlayer,
    };
  }
}
function destroyMusicPlayerExport() {
  destroyMusicPlayer();
}
__mod.boot = boot;
__mod.init = init;
__mod.destroyMusicPlayer = destroyMusicPlayer;

if (typeof startMusicPlayer !== 'undefined') __mod.startMusicPlayer = startMusicPlayer;
if (typeof destroyMusicPlayerExport !== 'undefined') __mod.destroyMusicPlayerExport = destroyMusicPlayerExport;
if (typeof boot !== 'undefined') __mod.boot = boot;
if (typeof init !== 'undefined') __mod.init = init;
if (typeof destroyMusicPlayer !== 'undefined') __mod.destroyMusicPlayer = destroyMusicPlayer;

};

/* ---- src/entry-music.js ---- */
__modules["src/entry-music.js"] = function (__mod, __require) {
var __dep0 = __require("src/host/music-player-host.js");
var startMusicPlayer = __dep0.startMusicPlayer;
/**
 * 浏览器打包入口（esbuild 会把它和依赖打成一个文件）
 * Hexo 只需引入 dist/floating-widget-music.js
 */

// 允许在引入脚本前设置 window.FWF_MUSIC 覆盖默认歌单
startMusicPlayer();


};

__require("src/entry-music.js");
})();
