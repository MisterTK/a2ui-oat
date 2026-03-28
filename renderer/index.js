/**
 * a2ui-oat Renderer Entry Point
 *
 * Single integration point for consumers of the Oat Renderer. Ties together the
 * renderer, all registered functions, and @a2ui/web-lib registration.
 *
 * @module a2ui-oat/renderer
 */

// --- Renderer -------------------------------------------------------------------

import { OatRenderer } from "./oat-renderer.js";

// --- Registered Functions -------------------------------------------------------

import { fetchPage } from "./functions/fetchPage.js";
import { fetchAndAppend } from "./functions/fetchAndAppend.js";
import { subscribeSSE } from "./functions/subscribeSSE.js";
import { subscribeWebSocket } from "./functions/subscribeWebSocket.js";
import { navigateTo } from "./functions/navigateTo.js";
import { showToast } from "./functions/showToast.js";
import { debounce } from "./functions/debounce.js";
import { formatDate } from "./functions/formatDate.js";
import { formatNumber } from "./functions/formatNumber.js";

// --- Constants ------------------------------------------------------------------

/** Canonical URL for the Oat Catalog JSON Schema. */
export const CATALOG_ID =
  "https://a2ui-oat.dev/catalog/v1/oat-catalog.json";

/** Current specification version of the Oat Renderer. */
export const VERSION = "v0.9";

// --- Public API -----------------------------------------------------------------

/**
 * Create a fully-wired Oat Renderer together with its function registry.
 *
 * @param {object} [options] - Renderer configuration forwarded to OatRenderer.
 * @returns {{
 *   renderer:   OatRenderer,
 *   functions:  Record<string, Function>,
 *   catalogId:  string,
 *   version:    string,
 * }}
 */
export function createOatRenderer(options = {}) {
  const renderer = new OatRenderer(options);
  const functions = {
    fetchPage,
    fetchAndAppend,
    subscribeSSE,
    subscribeWebSocket,
    navigateTo,
    showToast,
    debounce,
    formatDate,
    formatNumber,
  };

  return { renderer, functions, catalogId: CATALOG_ID, version: VERSION };
}

/**
 * Register the Oat Renderer and its functions with @a2ui/web-lib.
 *
 * This is the recommended one-call setup for consumers that use @a2ui/web-lib
 * as their protocol engine.
 *
 * @param {object} webLib  - The @a2ui/web-lib instance (or its registration API).
 * @param {object} [options] - Renderer configuration forwarded to OatRenderer.
 * @returns {OatRenderer} The renderer instance, ready for use.
 */
export function registerWithWebLib(webLib, options = {}) {
  const { renderer, functions, catalogId } = createOatRenderer(options);

  if (typeof webLib.registerRenderer === "function") {
    webLib.registerRenderer(catalogId, renderer);
  }

  if (typeof webLib.registerFunction === "function") {
    for (const [name, fn] of Object.entries(functions)) {
      webLib.registerFunction(name, fn);
    }
  }

  if (typeof webLib.setCatalogId === "function") {
    webLib.setCatalogId(catalogId);
  }

  return renderer;
}

// --- Re-exports -----------------------------------------------------------------

export { OatRenderer };
export {
  fetchPage,
  fetchAndAppend,
  subscribeSSE,
  subscribeWebSocket,
  navigateTo,
  showToast,
  debounce,
  formatDate,
  formatNumber,
};
