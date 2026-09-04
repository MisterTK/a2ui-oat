/**
 * a2ui-oat Renderer Entry Point
 *
 * Single integration point for consumers of the Oat Renderer. Ties together the
 * renderer and all registered functions. For real `@a2ui/web_core` protocol
 * integration, see `./surface-adapter.js` (`createSurfaceAdapter`).
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
import { openUrl } from "./functions/openUrl.js";
import { formatString } from "./functions/formatString.js";
import { formatCurrency } from "./functions/formatCurrency.js";
import { pluralize } from "./functions/pluralize.js";
import { and } from "./functions/and.js";
import { callMcpTool } from "./functions/callMcpTool.js";
import { or } from "./functions/or.js";
import { not } from "./functions/not.js";
import { required } from "./functions/required.js";
import { regex } from "./functions/regex.js";
import { length } from "./functions/length.js";
import { numeric } from "./functions/numeric.js";
import { email } from "./functions/email.js";

// --- Constants ------------------------------------------------------------------

/** Canonical URL for the Oat Catalog JSON Schema. */
export const CATALOG_ID =
  "https://unpkg.com/a2ui-oat/catalog/oat-catalog.json";

/** Current specification version of the Oat Renderer. */
export const VERSION = "v0.9.1";

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
    openUrl,
    formatString,
    formatCurrency,
    pluralize,
    and,
    callMcpTool,
    or,
    not,
    required,
    regex,
    length,
    numeric,
    email,
  };

  return { renderer, functions, catalogId: CATALOG_ID, version: VERSION };
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
  openUrl,
  formatString,
  formatCurrency,
  pluralize,
  and,
  callMcpTool,
  or,
  not,
  required,
  regex,
  length,
  numeric,
  email,
};
