/**
 * showToast -- Toast notification trigger using Oat CSS toast structure.
 *
 * Creates (or reuses) a `.toast-container[data-placement]` element, appends an
 * `<output class="toast">` with Oat's data-attribute animation pattern, and
 * auto-removes after `duration` ms.
 *
 * @param {object} args
 * @param {string}  args.message             - Toast message body (also accepts `text` for compat).
 * @param {string}  [args.title]             - Optional toast title rendered as h6.
 * @param {string}  [args.variant="info"]    - "success" | "warning" | "error" | "info".
 * @param {number}  [args.duration=4000]     - Auto-dismiss ms; 0 = persistent.
 * @param {string}  [args.placement="top-right"] - Container placement.
 * @param {object}  context                  - Renderer context.
 */

const VALID_VARIANTS = new Set(["success", "warning", "error", "info"]);

const VALID_PLACEMENTS = new Set([
  "top-left", "top-center", "top-right",
  "bottom-left", "bottom-center", "bottom-right",
]);

const DEFAULT_PLACEMENT = "top-right";
const DEFAULT_DURATION = 4000;
const EXIT_TIMEOUT = 300;

function identity(v) { return v; }

/**
 * Find or create the `.toast-container` for a given placement.
 */
function getContainer(placement) {
  const selector = `.toast-container[data-placement="${placement}"]`;
  let container = document.querySelector(selector);
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    container.dataset.placement = placement;
    document.body.appendChild(container);
  }
  return container;
}

/**
 * Animate a toast element out, then remove it from the DOM.
 */
function dismissToast(el) {
  if (el.dataset.exiting != null) return;
  el.dataset.exiting = "";
  const remove = () => { clearTimeout(fallback); el.remove(); };
  el.addEventListener("transitionend", remove, { once: true });
  const fallback = setTimeout(remove, EXIT_TIMEOUT);
}

export function showToast(args, context) {
  const resolve = context.resolveDynamic || identity;

  // Support both `message` and legacy `text` parameter names.
  const message = resolve(args.message || args.text);
  if (typeof message !== "string" || message === "") {
    throw new Error("showToast: 'message' (or 'text') must be a non-empty string");
  }

  const title = args.title ? resolve(args.title) : null;
  const rawVariant = args.variant ? resolve(args.variant) : "info";
  const variant = VALID_VARIANTS.has(rawVariant) ? rawVariant : "info";
  const duration = args.duration != null ? Number(resolve(args.duration)) : DEFAULT_DURATION;
  const rawPlacement = resolve(args.placement || args.position || DEFAULT_PLACEMENT);
  const placement = VALID_PLACEMENTS.has(rawPlacement) ? rawPlacement : DEFAULT_PLACEMENT;

  const container = getContainer(placement);

  const toast = document.createElement("output");
  toast.className = "toast";
  toast.setAttribute("role", "alert");
  toast.dataset.variant = variant;

  if (title) {
    const h6 = document.createElement("h6");
    h6.className = "toast-title";
    h6.textContent = title;
    toast.appendChild(h6);
  }

  const p = document.createElement("p");
  p.className = "toast-message";
  p.textContent = message;
  toast.appendChild(p);

  const closeBtn = document.createElement("button");
  closeBtn.dataset.close = "";
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.innerHTML = "&times;";
  closeBtn.addEventListener("click", () => dismissToast(toast));
  toast.appendChild(closeBtn);

  toast.dataset.entering = "";
  container.appendChild(toast);
  requestAnimationFrame(() => { delete toast.dataset.entering; });

  // Auto-dismiss with pause-on-hover.
  if (duration > 0) {
    let remaining = duration;
    let start = Date.now();
    let timer = setTimeout(() => dismissToast(toast), remaining);

    toast.addEventListener("mouseenter", () => {
      clearTimeout(timer);
      remaining -= Date.now() - start;
    });

    toast.addEventListener("mouseleave", () => {
      start = Date.now();
      timer = setTimeout(() => dismissToast(toast), remaining);
    });
  }
}
