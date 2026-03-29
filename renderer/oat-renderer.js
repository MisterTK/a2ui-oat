/**
 * Oat Renderer — maps A2UI catalog components to semantic HTML elements.
 *
 * This module is the bridge between @a2ui/web-lib (protocol engine) and
 * Oat CSS (styling). It takes A2UI component definitions and produces
 * DOM elements that Oat CSS styles automatically.
 *
 * @module oat-renderer
 */

/**
 * @typedef {Object} RenderContext
 * @property {function(): Object} getDataModel - Returns the current data model.
 * @property {function(string, *): void} setDataModel - Sets a value at a data model path.
 * @property {function(string, function): function} subscribe - Subscribes to data model changes at a path. Returns unsubscribe function.
 * @property {function(string): HTMLElement} renderChild - Renders a child component by its ID.
 * @property {function(Object): void} dispatchAction - Dispatches an action (functionCall or server event).
 * @property {function(string): function} getRegisteredFunction - Retrieves a registered function by name.
 */

/**
 * @typedef {Object} ComponentDef
 * @property {string} id - Unique component identifier.
 * @property {string} component - The component type name (e.g. "Text", "Button").
 * @property {Object} [properties] - Component-specific properties (spread at top level in A2UI).
 */

/**
 * OatRenderer maps all 37 Oat Catalog component types to semantic HTML.
 */

const TEXT_VARIANT_TAGS = {
  h1: 'h1', h2: 'h2', h3: 'h3', h4: 'h4', h5: 'h5', h6: 'h6',
  p: 'p', span: 'span', small: 'small', strong: 'strong', em: 'em',
  body: 'p', paragraph: 'p',  // backwards-compat aliases
};

const TEXT_FIELD_TYPES = {
  text: 'text', email: 'email', password: 'password',
  number: 'number', tel: 'tel', url: 'url', search: 'search',
};

export class OatRenderer {
  constructor() {
    /** @type {Map<string, function(ComponentDef, RenderContext): HTMLElement>} */
    this.renderers = new Map();
    this._registerAll();
  }

  /**
   * Render a component definition into a DOM element.
   *
   * @param {ComponentDef} component - The A2UI component definition.
   * @param {RenderContext} context - Rendering context provided by @a2ui/web-lib.
   * @returns {HTMLElement} The rendered DOM element.
   */
  renderComponent(component, context) {
    const renderFn = this.renderers.get(component.component);
    if (!renderFn) {
      const fallback = document.createElement('div');
      fallback.dataset.unknownComponent = component.component;
      fallback.textContent = `[Unknown component: ${component.component}]`;
      return fallback;
    }
    const el = renderFn(component, context);
    if (component.id) {
      el.dataset.componentId = component.id;
    }
    return el;
  }

  // ---------------------------------------------------------------------------
  // Internal registration
  // ---------------------------------------------------------------------------

  /** Register all 37 component renderers. */
  _registerAll() {
    // Layout
    this.renderers.set('Row', (c, ctx) => this._renderRow(c, ctx));
    this.renderers.set('Column', (c, ctx) => this._renderColumn(c, ctx));
    this.renderers.set('Grid', (c, ctx) => this._renderGrid(c, ctx));
    this.renderers.set('List', (c, ctx) => this._renderList(c, ctx));
    this.renderers.set('Sidebar', (c, ctx) => this._renderSidebar(c, ctx));

    // Display
    this.renderers.set('Text', (c, ctx) => this._renderText(c, ctx));
    this.renderers.set('Image', (c, ctx) => this._renderImage(c, ctx));
    this.renderers.set('Icon', (c, ctx) => this._renderIcon(c, ctx));
    this.renderers.set('Divider', (c, ctx) => this._renderDivider(c, ctx));
    this.renderers.set('Badge', (c, ctx) => this._renderBadge(c, ctx));
    this.renderers.set('Avatar', (c, ctx) => this._renderAvatar(c, ctx));
    this.renderers.set('Spinner', (c, ctx) => this._renderSpinner(c, ctx));
    this.renderers.set('Skeleton', (c, ctx) => this._renderSkeleton(c, ctx));
    this.renderers.set('Progress', (c, ctx) => this._renderProgress(c, ctx));
    this.renderers.set('Meter', (c, ctx) => this._renderMeter(c, ctx));
    this.renderers.set('Video', (c, ctx) => this._renderVideo(c, ctx));
    this.renderers.set('AudioPlayer', (c, ctx) => this._renderAudioPlayer(c, ctx));

    // Interactive
    this.renderers.set('Button', (c, ctx) => this._renderButton(c, ctx));
    this.renderers.set('TextField', (c, ctx) => this._renderTextField(c, ctx));
    this.renderers.set('CheckBox', (c, ctx) => this._renderCheckBox(c, ctx));
    this.renderers.set('Switch', (c, ctx) => this._renderSwitch(c, ctx));
    this.renderers.set('Slider', (c, ctx) => this._renderSlider(c, ctx));
    this.renderers.set('DateTimeInput', (c, ctx) => this._renderDateTimeInput(c, ctx));
    this.renderers.set('ChoicePicker', (c, ctx) => this._renderChoicePicker(c, ctx));
    this.renderers.set('Autocomplete', (c, ctx) => this._renderAutocomplete(c, ctx));

    // Container
    this.renderers.set('Card', (c, ctx) => this._renderCard(c, ctx));
    this.renderers.set('Modal', (c, ctx) => this._renderModal(c, ctx));
    this.renderers.set('Tabs', (c, ctx) => this._renderTabs(c, ctx));
    this.renderers.set('Accordion', (c, ctx) => this._renderAccordion(c, ctx));
    this.renderers.set('Tooltip', (c, ctx) => this._renderTooltip(c, ctx));
    this.renderers.set('Dropdown', (c, ctx) => this._renderDropdown(c, ctx));

    // Data & Feedback
    this.renderers.set('Table', (c, ctx) => this._renderTable(c, ctx));
    this.renderers.set('Pagination', (c, ctx) => this._renderPagination(c, ctx));
    this.renderers.set('Alert', (c, ctx) => this._renderAlert(c, ctx));
    this.renderers.set('Toast', (c, ctx) => this._renderToast(c, ctx));
    this.renderers.set('Breadcrumb', (c, ctx) => this._renderBreadcrumb(c, ctx));

    // Escape Hatch
    this.renderers.set('OatHTML', (c, ctx) => this._renderOatHTML(c, ctx));
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Resolve a property value. If it is a data-bound reference (object with a
   * `path` key), read from the data model. Otherwise return the literal.
   *
   * @param {*} value - Literal value or `{ path: string }`.
   * @param {RenderContext} context
   * @returns {*}
   */
  _resolve(value, context) {
    if (this._isBound(value)) {
      return this._getByPath(context.getDataModel(), value.path);
    }
    return value;
  }

  /**
   * Read a dot/slash-delimited path from an object.
   *
   * @param {Object} obj
   * @param {string} path - e.g. "/pagination/nextCursor" or "pagination.nextCursor"
   * @returns {*}
   */
  _getByPath(obj, path) {
    const segments = path.replace(/^\//, '').split(/[/.]/);
    let current = obj;
    for (const seg of segments) {
      if (current == null) return undefined;
      current = current[seg];
    }
    return current;
  }

  /**
   * Subscribe to a data-bound property and keep an element attribute or text in sync.
   *
   * @param {*} value - The property value (possibly `{ path }` binding).
   * @param {RenderContext} context
   * @param {function(*): void} apply - Called with the resolved value on each update.
   */
  _bindValue(value, context, apply) {
    apply(this._resolve(value, context));
    if (this._isBound(value)) {
      context.subscribe(value.path, (newVal) => apply(newVal));
    }
  }

  /**
   * Wire an action (functionCall or server event) to a DOM event on an element.
   *
   * @param {HTMLElement} el
   * @param {string} eventName - DOM event name (e.g. "click", "input").
   * @param {Object} action - A2UI action descriptor.
   * @param {RenderContext} context
   */
  _wireAction(el, eventName, action, context) {
    if (!action) return;
    el.addEventListener(eventName, (e) => {
      e.preventDefault();
      context.dispatchAction(action);
    });
  }

  /**
   * Render an array of child IDs into a parent element.
   *
   * @param {HTMLElement} parent
   * @param {string[]} childIds
   * @param {RenderContext} context
   */
  _renderChildren(parent, childIds, context) {
    if (!Array.isArray(childIds)) return;
    for (const id of childIds) {
      const child = context.renderChild(id);
      if (child) parent.appendChild(child);
    }
  }

  /**
   * Render a single child ID into a parent element.
   *
   * @param {HTMLElement} parent
   * @param {string} childId
   * @param {RenderContext} context
   */
  _renderSingleChild(parent, childId, context) {
    if (!childId) return;
    const child = context.renderChild(childId);
    if (child) parent.appendChild(child);
  }

  /**
   * Set an attribute only if the value is defined.
   *
   * @param {HTMLElement} el
   * @param {string} attr
   * @param {*} value
   */
  _setAttr(el, attr, value) {
    if (value != null) el.setAttribute(attr, String(value));
  }

  /**
   * Add a CSS class only if the value is truthy.
   *
   * @param {HTMLElement} el
   * @param {string} cls
   */
  _addClass(el, cls) {
    if (cls) el.classList.add(cls);
  }

  /**
   * Check whether a property value is a data-bound reference.
   *
   * @param {*} value
   * @returns {boolean}
   */
  _isBound(value) {
    return value != null && typeof value === 'object' && 'path' in value;
  }

  /**
   * Wire two-way binding for a form input: write back to the data model on change.
   *
   * @param {HTMLElement} el - The input element.
   * @param {*} binding - The property value (possibly `{ path }` binding).
   * @param {string} eventName - DOM event to listen on (e.g. "input", "change").
   * @param {function(HTMLElement): *} getValue - Extracts the value from the element.
   * @param {RenderContext} context
   */
  _wireTwoWay(el, binding, eventName, getValue, context) {
    if (!this._isBound(binding)) return;
    el.addEventListener(eventName, () => {
      context.setDataModel(binding.path, getValue(el));
    });
  }

  // ---------------------------------------------------------------------------
  // Layout components
  // ---------------------------------------------------------------------------

  /** @returns {HTMLElement} */
  _renderRow(c, ctx) {
    const el = document.createElement('div');
    el.className = 'row';
    if (c.justify) el.style.justifyContent = c.justify;
    if (c.align) el.style.alignItems = c.align;
    this._renderChildren(el, c.children, ctx);
    return el;
  }

  /** @returns {HTMLElement} */
  _renderColumn(c, ctx) {
    const el = document.createElement('div');
    const weight = c.weight || 1;
    el.className = `col-${weight}`;
    if (c.justify) el.style.justifyContent = c.justify;
    if (c.align) el.style.alignItems = c.align;
    this._renderChildren(el, c.children, ctx);
    return el;
  }

  /** @returns {HTMLElement} */
  _renderGrid(c, ctx) {
    const container = document.createElement('div');
    container.className = 'container';
    const row = document.createElement('div');
    row.className = 'row';
    if (c.gap) row.style.gap = c.gap;
    this._renderChildren(row, c.children, ctx);
    container.appendChild(row);
    return container;
  }

  /** @returns {HTMLElement} */
  _renderList(c, ctx) {
    const tag = (c.ordered || c.direction === 'ordered') ? 'ol' : 'ul';
    const el = document.createElement(tag);
    if (c.direction === 'horizontal') el.style.display = 'flex';
    if (Array.isArray(c.children)) {
      for (const id of c.children) {
        const li = document.createElement('li');
        const child = ctx.renderChild(id);
        if (child) li.appendChild(child);
        el.appendChild(li);
      }
    }
    return el;
  }

  /** @returns {HTMLElement} */
  _renderSidebar(c, ctx) {
    const el = document.createElement('aside');
    if (c.position) el.dataset.position = c.position;
    if (c.collapsible) el.dataset.collapsible = 'true';
    this._renderSingleChild(el, c.child, ctx);
    return el;
  }

  // ---------------------------------------------------------------------------
  // Display components
  // ---------------------------------------------------------------------------

  /** @returns {HTMLElement} */
  _renderText(c, ctx) {
    const tag = TEXT_VARIANT_TAGS[c.variant] || 'p';
    const el = document.createElement(tag);
    this._bindValue(c.text, ctx, (val) => { el.textContent = val ?? ''; });
    return el;
  }

  /** @returns {HTMLElement} */
  _renderImage(c, ctx) {
    const el = document.createElement('img');
    this._bindValue(c.url, ctx, (val) => { if (val) el.src = val; });
    if (c.alt) el.alt = c.alt;
    if (c.fit) el.style.objectFit = c.fit;
    this._addClass(el, c.variant);
    return el;
  }

  /** @returns {HTMLElement} */
  _renderIcon(c, ctx) {
    const el = document.createElement('span');
    if (c.name) el.className = `icon icon-${c.name}`;
    if (c.label) {
      el.setAttribute('aria-label', c.label);
      el.setAttribute('role', 'img');
    } else {
      el.setAttribute('aria-hidden', 'true');
    }
    if (c.size) el.dataset.size = c.size;
    return el;
  }

  /** @returns {HTMLElement} */
  _renderDivider(c, _ctx) {
    const el = document.createElement('hr');
    if (c.axis === 'vertical') el.dataset.axis = 'vertical';
    return el;
  }

  /** @returns {HTMLElement} */
  _renderBadge(c, ctx) {
    const el = document.createElement('span');
    el.dataset.badge = '';
    this._addClass(el, c.variant);
    this._bindValue(c.text, ctx, (val) => { el.textContent = val ?? ''; });
    return el;
  }

  /** @returns {HTMLElement} */
  _renderAvatar(c, ctx) {
    if (c.url) {
      const el = document.createElement('img');
      el.className = 'avatar';
      this._bindValue(c.url, ctx, (val) => { if (val) el.src = val; });
      this._setAttr(el, 'alt', c.alt || 'avatar');
      if (c.size) el.dataset.size = c.size;
      return el;
    }
    const el = document.createElement('span');
    el.className = 'avatar';
    if (c.size) el.dataset.size = c.size;
    el.setAttribute('role', 'img');
    this._bindValue(c.initials, ctx, (val) => {
      el.textContent = val ?? '';
      el.setAttribute('aria-label', val ?? 'avatar');
    });
    return el;
  }

  /** @returns {HTMLElement} */
  _renderSpinner(c, _ctx) {
    const el = document.createElement('div');
    el.className = 'spinner';
    if (c.size) el.dataset.size = c.size;
    return el;
  }

  /** @returns {HTMLElement} */
  _renderSkeleton(c, _ctx) {
    const el = document.createElement('div');
    el.className = 'skeleton';
    if (c.width) el.style.width = c.width;
    if (c.height) el.style.height = c.height;
    this._addClass(el, c.variant);
    return el;
  }

  /** @returns {HTMLElement} */
  _renderProgress(c, ctx) {
    const el = document.createElement('progress');
    this._bindValue(c.value, ctx, (val) => { if (val != null) el.value = val; });
    this._setAttr(el, 'max', c.max);
    return el;
  }

  /** @returns {HTMLElement} */
  _renderMeter(c, ctx) {
    const el = document.createElement('meter');
    this._bindValue(c.value, ctx, (val) => { if (val != null) el.value = val; });
    this._setAttr(el, 'min', c.min);
    this._setAttr(el, 'max', c.max);
    this._setAttr(el, 'low', c.low);
    this._setAttr(el, 'high', c.high);
    return el;
  }

  /** @returns {HTMLElement} */
  _renderVideo(c, ctx) {
    const el = document.createElement('video');
    this._bindValue(c.src, ctx, (val) => { if (val) el.src = val; });
    this._bindValue(c.poster, ctx, (val) => { if (val) el.poster = val; });
    if (c.controls !== false) el.controls = true;
    if (c.autoplay) el.autoplay = true;
    if (c.loop) el.loop = true;
    if (c.muted) el.muted = true;
    if (c.alt) el.setAttribute('aria-label', c.alt);
    return el;
  }

  /** @returns {HTMLElement} */
  _renderAudioPlayer(c, ctx) {
    const el = document.createElement('audio');
    this._bindValue(c.src, ctx, (val) => { if (val) el.src = val; });
    if (c.controls !== false) el.controls = true;
    if (c.autoplay) el.autoplay = true;
    if (c.loop) el.loop = true;
    return el;
  }

  // ---------------------------------------------------------------------------
  // Interactive components
  // ---------------------------------------------------------------------------

  /** @returns {HTMLElement} */
  _renderButton(c, ctx) {
    const el = document.createElement('button');
    this._addClass(el, c.variant);
    if (c.disabled) el.disabled = true;
    this._renderSingleChild(el, c.child, ctx);
    this._wireAction(el, 'click', c.action, ctx);
    return el;
  }

  /** @returns {HTMLElement} */
  _renderTextField(c, ctx) {
    const wrapper = document.createElement('label');
    if (c.label) {
      const labelText = document.createElement('span');
      labelText.textContent = c.label;
      wrapper.appendChild(labelText);
    }

    const tfVariant = c.variant ?? c.textFieldType;
    const isMultiline = tfVariant === 'multiline';
    const el = isMultiline
      ? document.createElement('textarea')
      : document.createElement('input');

    if (!isMultiline) {
      el.type = TEXT_FIELD_TYPES[tfVariant] || 'text';
    }

    if (c.placeholder) el.placeholder = c.placeholder;
    if (c.disabled) el.disabled = true;
    if (c.readOnly) el.readOnly = true;
    if (c.required) el.required = true;

    this._bindValue(c.value, ctx, (val) => { el.value = val ?? ''; });
    this._wireTwoWay(el, c.value, 'input', (e) => e.value, ctx);

    this._wireAction(el, 'change', c.action, ctx);
    wrapper.appendChild(el);
    return wrapper;
  }

  /** @returns {HTMLElement} */
  _renderCheckBox(c, ctx) {
    return this._renderToggle(c, ctx, false);
  }

  /** @returns {HTMLElement} */
  _renderSwitch(c, ctx) {
    return this._renderToggle(c, ctx, true);
  }

  /** Shared implementation for CheckBox and Switch. */
  _renderToggle(c, ctx, isSwitch) {
    const wrapper = document.createElement('label');
    const el = document.createElement('input');
    el.type = 'checkbox';
    if (isSwitch) el.role = 'switch';

    this._bindValue(c.value, ctx, (val) => { el.checked = Boolean(val); });
    this._wireTwoWay(el, c.value, 'change', (e) => e.checked, ctx);

    wrapper.appendChild(el);
    if (c.label) wrapper.append(` ${c.label}`);
    return wrapper;
  }

  /** @returns {HTMLElement} */
  _renderSlider(c, ctx) {
    const el = document.createElement('input');
    el.type = 'range';
    this._setAttr(el, 'min', c.min ?? c.minValue);
    this._setAttr(el, 'max', c.max ?? c.maxValue);
    if (c.step) this._setAttr(el, 'step', c.step);

    this._bindValue(c.value, ctx, (val) => { if (val != null) el.value = val; });
    this._wireTwoWay(el, c.value, 'input', (e) => Number(e.value), ctx);

    if (c.label) {
      const wrapper = document.createElement('label');
      const labelText = document.createElement('span');
      labelText.textContent = c.label;
      wrapper.appendChild(labelText);
      wrapper.appendChild(el);
      return wrapper;
    }
    return el;
  }

  /** @returns {HTMLElement} */
  _renderDateTimeInput(c, ctx) {
    const el = document.createElement('input');
    if (c.enableDate && c.enableTime) {
      el.type = 'datetime-local';
    } else if (c.enableTime) {
      el.type = 'time';
    } else {
      el.type = 'date';
    }

    this._bindValue(c.value, ctx, (val) => { if (val != null) el.value = val; });
    this._wireTwoWay(el, c.value, 'change', (e) => e.value, ctx);

    return el;
  }

  /** @returns {HTMLElement} */
  _renderChoicePicker(c, ctx) {
    const options = c.options || [];
    const maxSelections = c.maxSelections ?? 1;

    if (maxSelections > 1 || options.length > 5) {
      const el = document.createElement('select');
      if (maxSelections > 1) el.multiple = true;

      for (const opt of options) {
        const option = document.createElement('option');
        option.value = opt.value ?? opt.label;
        option.textContent = opt.label;
        el.appendChild(option);
      }

      this._bindValue(c.selections, ctx, (val) => {
        if (!Array.isArray(val)) return;
        for (const option of el.options) {
          option.selected = val.includes(option.value);
        }
      });

      if (this._isBound(c.selections)) {
        el.addEventListener('change', () => {
          const selected = Array.from(el.selectedOptions).map((o) => o.value);
          ctx.setDataModel(c.selections.path, selected);
        });
      }

      return el;
    }

    const fieldset = document.createElement('fieldset');
    if (c.label) {
      const legend = document.createElement('legend');
      legend.textContent = c.label;
      fieldset.appendChild(legend);
    }

    const groupName = c.id || `choice-${Math.random().toString(36).slice(2, 8)}`;

    for (const opt of options) {
      const label = document.createElement('label');
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = groupName;
      radio.value = opt.value ?? opt.label;

      if (this._isBound(c.selections)) {
        radio.addEventListener('change', () => {
          if (radio.checked) ctx.setDataModel(c.selections.path, [radio.value]);
        });
      }

      label.appendChild(radio);
      label.append(` ${opt.label}`);
      fieldset.appendChild(label);
    }

    this._bindValue(c.selections, ctx, (val) => {
      if (!Array.isArray(val)) return;
      for (const radio of fieldset.querySelectorAll('input[type="radio"]')) {
        radio.checked = val.includes(radio.value);
      }
    });

    return fieldset;
  }

  /** @returns {HTMLElement} */
  _renderAutocomplete(c, ctx) {
    const wrapper = document.createElement('div');
    wrapper.className = 'autocomplete-wrapper';

    const el = document.createElement('input');
    el.type = 'text';
    if (c.placeholder) el.placeholder = c.placeholder;
    if (c.minChars) el.dataset.minChars = c.minChars;

    this._bindValue(c.value, ctx, (val) => { el.value = val ?? ''; });
    this._wireTwoWay(el, c.value, 'input', (e) => e.value, ctx);

    if (c.source) el.dataset.autocompleteSource = this._resolve(c.source, ctx) ?? '';

    this._wireAction(el, 'change', c.action, ctx);
    wrapper.appendChild(el);
    return wrapper;
  }

  // ---------------------------------------------------------------------------
  // Container components
  // ---------------------------------------------------------------------------

  /** @returns {HTMLElement} */
  _renderCard(c, ctx) {
    const el = document.createElement('article');
    if (c.title) {
      const header = document.createElement('header');
      header.textContent = c.title;
      el.appendChild(header);
    }
    this._renderSingleChild(el, c.child, ctx);
    return el;
  }

  /** @returns {HTMLElement} */
  _renderModal(c, ctx) {
    const dialog = document.createElement('dialog');

    const dismissible = c.dismissible !== false;
    if (dismissible) {
      dialog.addEventListener('click', (e) => {
        if (e.target === dialog) dialog.close();
      });
    } else {
      dialog.addEventListener('cancel', (e) => { e.preventDefault(); });
    }

    const content = c.content ?? c.contentChild;
    this._renderSingleChild(dialog, content, ctx);

    const trigger = c.trigger ?? c.entryPointChild;
    if (trigger) {
      const wrapper = document.createElement('div');
      const triggerEl = ctx.renderChild(trigger);
      if (triggerEl) {
        triggerEl.addEventListener('click', (e) => {
          e.preventDefault();
          dialog.showModal();
        });
        wrapper.appendChild(triggerEl);
      }
      wrapper.appendChild(dialog);
      return wrapper;
    }

    return dialog;
  }

  /** @returns {HTMLElement} */
  _renderTabs(c, ctx) {
    const el = document.createElement('oat-tabs');
    const tabs = c.tabs ?? c.tabItems;
    const items = tabs || [];
    const activeTab = c.activeTab != null ? this._resolve(c.activeTab, ctx) : 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const panel = document.createElement('div');
      panel.slot = 'panel';
      panel.dataset.title = item.title || '';
      if (i === activeTab) panel.dataset.active = 'true';
      this._renderSingleChild(panel, item.child, ctx);
      el.appendChild(panel);
    }

    return el;
  }

  /** @returns {HTMLElement} */
  _renderAccordion(c, ctx) {
    const wrapper = document.createElement('div');
    wrapper.className = 'accordion';
    const items = c.items || [];

    for (const item of items) {
      const details = document.createElement('details');
      if (c.grouped) details.dataset.grouped = 'true';
      const summary = document.createElement('summary');
      summary.textContent = item.title || '';
      details.appendChild(summary);
      this._renderSingleChild(details, item.child, ctx);
      wrapper.appendChild(details);
    }

    return wrapper;
  }

  /** @returns {HTMLElement} */
  _renderTooltip(c, ctx) {
    const el = document.createElement('span');
    el.dataset.tooltip = this._resolve(c.text, ctx) ?? '';
    if (c.position) el.dataset.tooltipPosition = c.position;
    el.setAttribute('tabindex', '0');
    this._renderSingleChild(el, c.child, ctx);
    return el;
  }

  /** @returns {HTMLElement} */
  _renderDropdown(c, ctx) {
    const el = document.createElement('oat-dropdown');
    if (c.position) el.dataset.position = c.position;
    this._renderSingleChild(el, c.child, ctx);
    const menu = document.createElement('menu');
    menu.slot = 'menu';
    const items = c.items || [];
    for (const item of items) {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.textContent = item.label || '';
      if (item.disabled) btn.disabled = true;
      this._wireAction(btn, 'click', item.action, ctx);
      li.appendChild(btn);
      menu.appendChild(li);
    }
    el.appendChild(menu);
    return el;
  }

  // ---------------------------------------------------------------------------
  // Data & Feedback components
  // ---------------------------------------------------------------------------

  /** @returns {HTMLElement} */
  _renderTable(c, ctx) {
    const table = document.createElement('table');
    if (c.striped) table.dataset.striped = 'true';
    if (c.sortable) table.dataset.sortable = 'true';

    const columns = c.columns || [];
    if (columns.length > 0) {
      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
      for (const col of columns) {
        const th = document.createElement('th');
        th.textContent = col.label || col.key || '';
        if (col.key) th.dataset.key = col.key;
        if (c.sortable && col.sortable !== false) {
          th.dataset.sortable = 'true';
        }
        headerRow.appendChild(th);
      }
      thead.appendChild(headerRow);
      table.appendChild(thead);
    }

    const tbody = document.createElement('tbody');

    const renderRows = (rows) => {
      tbody.innerHTML = '';
      if (!Array.isArray(rows)) return;
      for (const rowData of rows) {
        const tr = document.createElement('tr');
        for (const col of columns) {
          const td = document.createElement('td');
          const key = col.key;
          td.textContent = key ? (rowData[key] ?? '') : '';
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      }
    };

    this._bindValue(c.rows, ctx, renderRows);

    table.appendChild(tbody);
    return table;
  }

  /** @returns {HTMLElement} */
  _renderPagination(c, ctx) {
    const nav = document.createElement('nav');
    nav.setAttribute('aria-label', 'pagination');

    const renderPages = () => {
      const currentPage = this._resolve(c.currentPage, ctx) ?? 1;
      const totalPages = this._resolve(c.totalPages, ctx) ?? 1;

      nav.innerHTML = '';

      const prevBtn = document.createElement('button');
      prevBtn.textContent = '\u2190';
      prevBtn.disabled = currentPage <= 1;
      const pageIsBound = this._isBound(c.currentPage);

      const wirePageAction = (btn, targetPage) => {
        if (!c.action) return;
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          if (pageIsBound) ctx.setDataModel(c.currentPage.path, targetPage);
          ctx.dispatchAction(c.action);
        });
      };

      wirePageAction(prevBtn, currentPage - 1);
      nav.appendChild(prevBtn);

      for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.textContent = String(i);
        if (i === currentPage) btn.setAttribute('aria-current', 'page');
        wirePageAction(btn, i);
        nav.appendChild(btn);
      }

      const nextBtn = document.createElement('button');
      nextBtn.textContent = '\u2192';
      nextBtn.disabled = currentPage >= totalPages;
      wirePageAction(nextBtn, currentPage + 1);
      nav.appendChild(nextBtn);
    };

    renderPages();

    if (this._isBound(c.currentPage)) ctx.subscribe(c.currentPage.path, renderPages);
    if (this._isBound(c.totalPages)) ctx.subscribe(c.totalPages.path, renderPages);

    return nav;
  }

  /** @returns {HTMLElement} */
  _renderAlert(c, ctx) {
    const el = document.createElement('div');
    el.setAttribute('role', 'alert');
    if (c.variant) el.dataset.variant = c.variant;
    this._bindValue(c.text, ctx, (val) => { el.textContent = val ?? ''; });
    return el;
  }

  /** @returns {HTMLElement} */
  _renderToast(c, ctx) {
    const el = document.createElement('output');
    el.setAttribute('role', 'alert');
    el.className = 'toast';
    if (c.variant) el.dataset.variant = c.variant;

    if (c.title) {
      const titleEl = document.createElement('h6');
      titleEl.className = 'toast-title';
      this._bindValue(c.title, ctx, (val) => { titleEl.textContent = val ?? ''; });
      el.appendChild(titleEl);
    }

    const msgEl = document.createElement('p');
    msgEl.className = 'toast-message';
    this._bindValue(c.text, ctx, (val) => { msgEl.textContent = val ?? ''; });
    el.appendChild(msgEl);

    const closeBtn = document.createElement('button');
    closeBtn.setAttribute('data-close', '');
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '\u00d7';
    closeBtn.addEventListener('click', () => { el.remove(); });
    el.appendChild(closeBtn);

    el.dataset.entering = '';
    requestAnimationFrame(() => { delete el.dataset.entering; });

    if (c.duration) {
      const ms = typeof c.duration === 'number' ? c.duration : parseInt(c.duration, 10);
      if (ms > 0) {
        setTimeout(() => {
          el.dataset.exiting = '';
          setTimeout(() => { el.remove(); }, 300);
        }, ms);
      }
    }

    const placement = this._resolve(c.position, ctx) || 'top-right';
    const selector = `.toast-container[data-placement="${placement}"]`;
    let container = document.querySelector(selector);
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      container.dataset.placement = placement;
      document.body.appendChild(container);
    }
    container.appendChild(el);

    return el;
  }

  /** @returns {HTMLElement} */
  _renderBreadcrumb(c, ctx) {
    const nav = document.createElement('nav');
    nav.setAttribute('aria-label', 'breadcrumb');
    const ol = document.createElement('ol');
    const items = c.items || [];

    for (const item of items) {
      const li = document.createElement('li');
      if (item.action) {
        const a = document.createElement('a');
        a.href = '#';
        a.textContent = item.label || '';
        this._wireAction(a, 'click', item.action, ctx);
        li.appendChild(a);
      } else {
        li.textContent = item.label || '';
        li.setAttribute('aria-current', 'page');
      }
      ol.appendChild(li);
    }

    nav.appendChild(ol);
    return nav;
  }

  // ---------------------------------------------------------------------------
  // Escape Hatch
  // ---------------------------------------------------------------------------

  /** @returns {HTMLElement} */
  _renderOatHTML(c, ctx) {
    const el = document.createElement('div');
    el.dataset.oathtml = '';
    const shouldSanitize = c.sanitize !== false;
    this._bindValue(c.html, ctx, (val) => {
      if (shouldSanitize) {
        el.textContent = val ?? '';
      } else {
        el.innerHTML = val ?? '';
      }
    });
    return el;
  }
}
