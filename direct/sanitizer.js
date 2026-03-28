/**
 * HTML Sanitizer for the OatHTML escape hatch component (Security Tier 2).
 *
 * When agents emit HTML strings via the OatHTML component in A2UI mode,
 * this sanitizer filters the HTML before DOM injection. It uses the
 * browser-native DOMParser API -- no external dependencies.
 *
 * @module direct/sanitizer
 */

// ---------------------------------------------------------------------------
// Default allowlists
// ---------------------------------------------------------------------------

const DEFAULT_ALLOWED_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'a', 'strong', 'em', 'code', 'pre', 'blockquote',
  'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'img', 'hr', 'br',
  'div', 'span', 'section', 'article', 'aside', 'nav',
  'header', 'footer', 'main',
  'details', 'summary', 'dialog',
  'progress', 'meter',
  'input', 'button', 'select', 'option', 'textarea', 'label',
  'form', 'fieldset', 'legend',
  'figure', 'figcaption',
  'mark', 'time', 'abbr', 'cite', 'small',
]);

const DEFAULT_ALLOWED_ATTRS = new Set([
  'class', 'id', 'href', 'src', 'alt', 'title',
  'role',
  'type', 'name', 'value', 'placeholder',
  'disabled', 'checked', 'selected',
  'for', 'action', 'method',
  'width', 'height',
  'colspan', 'rowspan',
  'open',
  'min', 'max', 'low', 'high', 'optimum',
]);

// Attribute name prefixes that are allowed as wildcards (aria-*, data-*).
const WILDCARD_ATTR_PREFIXES = ['aria-', 'data-'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return true if the attribute name is on the allowlist (exact match or
 * wildcard prefix match for aria-* / data-*).
 */
function isAllowedAttr(name, allowedAttrs, wildcardPrefixes) {
  if (allowedAttrs.has(name)) return true;
  for (const prefix of wildcardPrefixes) {
    if (name.startsWith(prefix)) return true;
  }
  return false;
}

/**
 * Return true if the given URL string looks like a dangerous protocol
 * (javascript:, data: that is not an image, vbscript:, etc.).
 */
function isDangerousUrl(value) {
  const trimmed = value.replace(/[\s\u0000-\u001F]+/g, '').toLowerCase();
  if (trimmed.startsWith('javascript:')) return true;
  if (trimmed.startsWith('vbscript:')) return true;
  // Allow data: URLs only for images.
  if (trimmed.startsWith('data:')) {
    return !trimmed.startsWith('data:image/');
  }
  return false;
}

/**
 * Return true if the attribute name looks like an inline event handler
 * (onclick, onerror, onload, ...).
 */
function isEventHandler(name) {
  return /^on[a-z]/i.test(name);
}

// ---------------------------------------------------------------------------
// Core sanitization
// ---------------------------------------------------------------------------

/**
 * Sanitize an element node in place. Recursively walks the DOM tree,
 * removing disallowed elements and attributes.
 */
function sanitizeNode(node, allowedTags, allowedAttrs, wildcardPrefixes) {
  // Snapshot children so DOM mutations during iteration are safe.
  const children = Array.from(node.childNodes);
  for (const child of children) {
    if (child.nodeType === 1 /* ELEMENT_NODE */) {
      const tag = child.tagName.toLowerCase();

      if (!allowedTags.has(tag)) {
        // Disallowed tag: replace with its children (unwrap) unless it is a
        // script/style in which case we drop the entire subtree.
        if (tag === 'script' || tag === 'style') {
          child.remove();
        } else {
          // Unwrap: move children before the disallowed node, then remove it.
          while (child.firstChild) {
            node.insertBefore(child.firstChild, child);
          }
          child.remove();
        }
        // Re-process this portion since we mutated the tree.
        sanitizeNode(node, allowedTags, allowedAttrs, wildcardPrefixes);
        return;
      }

      // Allowed tag -- now strip disallowed attributes.
      const attrs = Array.from(child.attributes);
      for (const attr of attrs) {
        const name = attr.name.toLowerCase();

        if (isEventHandler(name)) {
          child.removeAttribute(attr.name);
          continue;
        }

        if (!isAllowedAttr(name, allowedAttrs, wildcardPrefixes)) {
          child.removeAttribute(attr.name);
          continue;
        }

        // For URL-bearing attributes, check for dangerous protocols.
        if ((name === 'href' || name === 'src' || name === 'action') &&
            isDangerousUrl(attr.value)) {
          child.removeAttribute(attr.name);
        }
      }

      // Recurse into allowed element.
      sanitizeNode(child, allowedTags, allowedAttrs, wildcardPrefixes);
    }
    // Text nodes and comment nodes are left as-is (comments are harmless).
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Merge a user-supplied config with the built-in defaults.
 *
 * Config shape:
 *   {
 *     allowedTags:   string[] | Set<string>,  // override tag allowlist
 *     allowedAttrs:  string[] | Set<string>,  // override attribute allowlist
 *     extraTags:     string[] | Set<string>,  // add to default tag allowlist
 *     extraAttrs:    string[] | Set<string>,  // add to default attribute allowlist
 *     wildcardPrefixes: string[],             // override wildcard prefixes
 *   }
 */
function resolveConfig(config) {
  const cfg = config || {};

  let tags;
  if (cfg.allowedTags) {
    tags = new Set(cfg.allowedTags);
  } else {
    tags = new Set(DEFAULT_ALLOWED_TAGS);
    if (cfg.extraTags) {
      for (const t of cfg.extraTags) tags.add(t);
    }
  }

  let attrs;
  if (cfg.allowedAttrs) {
    attrs = new Set(cfg.allowedAttrs);
  } else {
    attrs = new Set(DEFAULT_ALLOWED_ATTRS);
    if (cfg.extraAttrs) {
      for (const a of cfg.extraAttrs) attrs.add(a);
    }
  }

  const wildcardPrefixes = cfg.wildcardPrefixes || WILDCARD_ATTR_PREFIXES;

  return { tags, attrs, wildcardPrefixes };
}

/**
 * Sanitize an HTML string, returning a clean HTML string containing only
 * allowed tags and attributes. Scripts, styles, event handlers, and
 * dangerous URLs are stripped.
 *
 * @param {string} html - The untrusted HTML string.
 * @param {object} [config] - Optional configuration overrides.
 * @returns {string} The sanitized HTML string.
 */
export function sanitize(html, config) {
  if (typeof html !== 'string' || html.length === 0) return '';

  const { tags, attrs, wildcardPrefixes } = resolveConfig(config);

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  sanitizeNode(doc.body, tags, attrs, wildcardPrefixes);

  return doc.body.innerHTML;
}

/**
 * Create a reusable sanitizer function with baked-in configuration.
 * Useful when the same config is applied to many HTML fragments.
 *
 * @param {object} [config] - Configuration overrides (same shape as sanitize).
 * @returns {function(string): string} A bound sanitize function.
 */
export function createSanitizer(config) {
  const resolved = resolveConfig(config);
  return function boundSanitize(html) {
    if (typeof html !== 'string' || html.length === 0) return '';

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    sanitizeNode(doc.body, resolved.tags, resolved.attrs, resolved.wildcardPrefixes);

    return doc.body.innerHTML;
  };
}
