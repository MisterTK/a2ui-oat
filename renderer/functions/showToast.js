/**
 * showToast -- Toast notification trigger backed by Oat Toast Web Component.
 *
 * Creates (or reuses) a positioned toast container, appends a toast element
 * styled with Oat data-attributes, and auto-removes it after `duration` ms.
 *
 * @param {object} args
 * @param {string}  args.text               - Toast message text (required).
 * @param {string}  [args.variant="info"]    - "success" | "warning" | "error" | "info".
 * @param {number}  [args.duration=3000]     - Auto-dismiss time in milliseconds.
 * @param {string}  [args.position="top-right"] - Screen position for the toast container.
 * @param {object}  context                  - Renderer context.
 */

const VALID_VARIANTS = new Set(["success", "warning", "error", "info"]);

const POSITION_STYLES = {
  "top-left":      { top: "1rem", left: "1rem" },
  "top-center":    { top: "1rem", left: "50%", transform: "translateX(-50%)" },
  "top-right":     { top: "1rem", right: "1rem" },
  "bottom-left":   { bottom: "1rem", left: "1rem" },
  "bottom-center": { bottom: "1rem", left: "50%", transform: "translateX(-50%)" },
  "bottom-right":  { bottom: "1rem", right: "1rem" },
};

export function showToast(args, context) {
  const resolve = context.resolveDynamic || identity;

  const text = resolve(args.text);
  if (typeof text !== "string" || text === "") {
    throw new Error("showToast: 'text' must be a non-empty string");
  }

  const variant = args.variant ? resolve(args.variant) : "info";
  const duration = args.duration != null ? Number(resolve(args.duration)) : 3000;
  const position = args.position ? resolve(args.position) : "top-right";

  const safeVariant = VALID_VARIANTS.has(variant) ? variant : "info";

  const containerId = `oat-toast-container-${position}`;
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement("div");
    container.id = containerId;
    container.setAttribute("role", "status");
    container.setAttribute("aria-live", "polite");
    container.dataset.toastContainer = "";
    container.dataset.position = position;
    applyPositionStyles(container, position);
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.setAttribute("role", "alert");
  toast.dataset.variant = safeVariant;
  toast.dataset.toast = "";
  toast.textContent = text;

  container.appendChild(toast);

  if (duration > 0) {
    setTimeout(function () {
      toast.remove();
    }, duration);
  }
}

function applyPositionStyles(el, position) {
  const offsets = POSITION_STYLES[position] || POSITION_STYLES["top-right"];
  Object.assign(el.style, {
    position: "fixed",
    zIndex: "9999",
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    pointerEvents: "none",
    ...offsets,
  });
}

function identity(v) { return v; }
