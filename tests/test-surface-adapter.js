/**
 * Tests for the real @a2ui/web_core surface adapter.
 * Runs against the actual published package (devDependency), not a mock.
 */
import { describe, it, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { installDomShim, findEl, findAllEl } from './helpers/dom-shim.js';

installDomShim();

const webCore = await import('@a2ui/web_core/v0_9');
const { createSurfaceAdapter } = await import('../renderer/surface-adapter.js');
const { CATALOG_ID } = await import('../renderer/index.js');

const V = 'v0.9.1';
const create = (surfaceId = 's1', extra = {}) =>
  ({ version: V, createSurface: { surfaceId, catalogId: CATALOG_ID, ...extra } });
const update = (components, surfaceId = 's1') =>
  ({ version: V, updateComponents: { surfaceId, components } });
const data = (path, value, surfaceId = 's1') =>
  ({ version: V, updateDataModel: { surfaceId, path, value } });

function makeAdapter(extra = {}) {
  const container = document.createElement('div');
  const actions = [];
  const errors = [];
  const adapter = createSurfaceAdapter({
    webCore,
    container,
    onAction: (a) => actions.push(a),
    onError: (e) => errors.push(e),
    ...extra,
  });
  return { adapter, container, actions, errors };
}

describe('createSurfaceAdapter construction', () => {
  it('throws without webCore', () => {
    assert.throws(() => createSurfaceAdapter({ container: document.createElement('div') }),
      /webCore/);
  });
  it('throws when webCore is too old (no NodeResolver)', () => {
    assert.throws(() => createSurfaceAdapter({
      webCore: { ...webCore, NodeResolver: undefined },
      container: document.createElement('div'),
    }), /0\.10\.7/);
  });
  it('throws without container', () => {
    assert.throws(() => createSurfaceAdapter({ webCore }), /container/);
  });
});

describe('static rendering through the real protocol engine', () => {
  it('renders a component tree from wire messages', () => {
    const { adapter, container } = makeAdapter();
    adapter.processMessages([
      create(),
      update([
        { id: 'root', component: 'Column', children: ['t1', 'b1'] },
        { id: 't1', component: 'Text', text: 'Hello' },
        { id: 'b1', component: 'Button', child: 'b1label' },
        { id: 'b1label', component: 'Text', text: 'Go' },
      ]),
    ]);
    const text = findEl(container, (el) => el.textContent === 'Hello');
    assert.ok(text, 'Text component rendered');
    const btn = findEl(container, (el) => el.tagName === 'BUTTON');
    assert.ok(btn, 'Button rendered');
    assert.equal(findEl(container, (el) => el.dataset.surfaceId === 's1').dataset.surfaceId, 's1');
  });

  it('accepts v0.9 messages too', () => {
    const { adapter, container } = makeAdapter();
    adapter.processMessages([
      { version: 'v0.9', createSurface: { surfaceId: 's1', catalogId: CATALOG_ID } },
      { version: 'v0.9', updateComponents: { surfaceId: 's1', components: [
        { id: 'root', component: 'Text', text: 'legacy' },
      ] } },
    ]);
    assert.ok(findEl(container, (el) => el.textContent === 'legacy'));
  });

  it('resolves single-child refs (Card)', () => {
    const { adapter, container } = makeAdapter();
    adapter.processMessages([
      create(),
      update([
        { id: 'root', component: 'Card', child: 'inner' },
        { id: 'inner', component: 'Text', text: 'inside' },
      ]),
    ]);
    assert.ok(findEl(container, (el) => el.textContent === 'inside'));
  });

  it('reports malformed batches via onError without killing existing surfaces', () => {
    const { adapter, container, errors } = makeAdapter();
    adapter.processMessages([create(), update([
      { id: 'root', component: 'Text', text: 'still here' },
    ])]);
    adapter.processMessages([update([
      { id: 'root', component: 'Text', bogusProp: 1 },
    ])]);
    assert.ok(errors.length >= 1, 'validation error surfaced');
    assert.ok(findEl(container, (el) => el.textContent === 'still here'));
  });
});

describe('reactivity through the real signals pipeline', () => {
  it('updates bound text on updateDataModel without re-mounting', () => {
    const { adapter, container } = makeAdapter();
    adapter.processMessages([
      create(),
      data('/user', { name: 'Ada' }),
      update([{ id: 'root', component: 'Text', text: { path: '/user/name' } }]),
    ]);
    const before = findEl(container, (el) => el.textContent === 'Ada');
    assert.ok(before, 'initial bound value rendered');
    adapter.processMessages([data('/user/name', 'Grace')]);
    // Assert on DOM identity/attachment, not just a captured reference's
    // content: `before.textContent` would keep updating even if `before` had
    // been detached and replaced by a new element, as long as its own
    // (orphaned) subscribe() callback were still wired to it -- that would
    // prove nothing about "no re-mount". Confirming `before` is still findable
    // by reference in the live tree proves it genuinely was never replaced.
    assert.equal(findEl(container, (el) => el === before), before,
      'the original element is still attached to the live tree (no replaceWith rebuild)');
    assert.equal(before.textContent, 'Grace', 'and it was patched in place');
  });

  it('writes two-way bindings back into the real DataModel', () => {
    const { adapter, container } = makeAdapter();
    adapter.processMessages([
      create(),
      data('/form', { name: '' }),
      update([{ id: 'root', component: 'TextField',
                label: 'Name', value: { path: '/form/name' } }]),
    ]);
    const input = findEl(container, (el) => el.tagName === 'INPUT');
    assert.ok(input, 'TextField input rendered');
    input.value = 'Linus';
    input.dispatchEvent({ type: 'input', target: input });
    const surface = adapter.processor.model.getSurface('s1');
    assert.equal(surface.dataModel.get('/form/name'), 'Linus');
  });

  it('re-renders a container when its child list changes', () => {
    const { adapter, container } = makeAdapter();
    adapter.processMessages([
      create(),
      update([
        { id: 'root', component: 'Column', children: ['t1'] },
        { id: 't1', component: 'Text', text: 'one' },
      ]),
    ]);
    assert.ok(findEl(container, (el) => el.textContent === 'one'));
    assert.equal(findEl(container, (el) => el.textContent === 'two'), null);
    adapter.processMessages([
      update([
        { id: 'root', component: 'Column', children: ['t1', 't2'] },
        { id: 't2', component: 'Text', text: 'two' },
      ]),
    ]);
    assert.ok(findEl(container, (el) => el.textContent === 'two'),
      'newly added child rendered');
  });
});

describe('interactive controls preserve DOM identity across keystrokes (Critical #1)', () => {
  it('keeps the SAME <input> element attached across multiple keystrokes into a two-way-bound TextField', () => {
    const { adapter, container } = makeAdapter();
    adapter.processMessages([
      create(),
      data('/form', { name: '' }),
      update([{ id: 'root', component: 'TextField',
                label: 'Name', value: { path: '/form/name' } }]),
    ]);
    const input = findEl(container, (el) => el.tagName === 'INPUT');
    assert.ok(input, 'TextField input rendered');

    input.value = 'L';
    input.dispatchEvent({ type: 'input', target: input });
    assert.equal(findEl(container, (el) => el === input), input,
      'input element is still the live one after the first keystroke');

    input.value = 'Li';
    input.dispatchEvent({ type: 'input', target: input });
    assert.equal(findEl(container, (el) => el === input), input,
      'input element is still the SAME reference after a second keystroke -- a ' +
      'replaceWith-based rebuild would detach the original and this lookup would fail');

    const surface = adapter.processor.model.getSurface('s1');
    assert.equal(surface.dataModel.get('/form/name'), 'Li');
  });

  it('does not grow live DataContext subscriptions per keystroke into the same bound TextField', () => {
    const original = webCore.DataContext.prototype.subscribeDynamicValue;
    let created = 0;
    let unsubscribed = 0;
    webCore.DataContext.prototype.subscribeDynamicValue = function (...args) {
      created += 1;
      const sub = original.apply(this, args);
      let done = false;
      return {
        get value() { return sub.value; },
        unsubscribe: () => {
          if (!done) { done = true; unsubscribed += 1; }
          sub.unsubscribe();
        },
      };
    };
    try {
      const { adapter, container } = makeAdapter();
      adapter.processMessages([
        create(),
        data('/form', { name: '' }),
        update([{ id: 'root', component: 'TextField',
                  label: 'Name', value: { path: '/form/name' } }]),
      ]);
      const input = findEl(container, (el) => el.tagName === 'INPUT');
      const live = () => created - unsubscribed;

      input.value = 'L';
      input.dispatchEvent({ type: 'input', target: input });
      const liveAfterFirst = live();

      for (const ch of ['Li', 'Lin', 'Linu', 'Linus']) {
        input.value = ch;
        input.dispatchEvent({ type: 'input', target: input });
      }
      const liveAfterMore = live();

      assert.equal(liveAfterMore, liveAfterFirst,
        `live (created-minus-unsubscribed) subscription count must not grow across ` +
        `keystrokes -- a rebuild-per-keystroke bug leaks one per keystroke (after 1st ` +
        `keystroke: ${liveAfterFirst}, after 5 more: ${liveAfterMore})`);

      const surface = adapter.processor.model.getSurface('s1');
      assert.equal(surface.dataModel.get('/form/name'), 'Linus');
    } finally {
      webCore.DataContext.prototype.subscribeDynamicValue = original;
    }
  });
});

describe('fine-grained structural re-render (no coarse full-surface rebuild)', () => {
  it('leaves an unrelated sibling element untouched when a nested list changes', () => {
    const { adapter, container } = makeAdapter();
    adapter.processMessages([
      create(),
      update([
        { id: 'root', component: 'Column', children: ['list', 'sibling'] },
        { id: 'list', component: 'Column', children: ['t1'] },
        { id: 't1', component: 'Text', text: 'one' },
        { id: 'sibling', component: 'Text', text: 'unchanged' },
      ]),
    ]);
    const siblingBefore = findEl(container, (el) => el.textContent === 'unchanged');
    assert.ok(siblingBefore, 'sibling rendered');
    adapter.processMessages([
      update([
        { id: 'list', component: 'Column', children: ['t1', 't2'] },
        { id: 't2', component: 'Text', text: 'two' },
      ]),
    ]);
    assert.ok(findEl(container, (el) => el.textContent === 'two'), 'new item rendered');
    const siblingAfter = findEl(container, (el) => el.textContent === 'unchanged');
    assert.equal(siblingAfter, siblingBefore,
      'sibling is the SAME DOM node instance, not recreated by a full-surface rebuild');
  });

  it('leaves an unrelated sibling untouched when a placeholder child resolves', () => {
    const { adapter, container } = makeAdapter();
    adapter.processMessages([
      create(),
      update([
        { id: 'root', component: 'Column', children: ['group', 'sibling'] },
        { id: 'group', component: 'Column', children: ['lazy'] },
        { id: 'sibling', component: 'Text', text: 'unchanged' },
      ]),
    ]);
    const siblingBefore = findEl(container, (el) => el.textContent === 'unchanged');
    assert.ok(siblingBefore, 'sibling rendered while "lazy" is still a placeholder');
    assert.equal(findEl(container, (el) => el.textContent === 'arrived late'), null);
    adapter.processMessages([
      update([{ id: 'lazy', component: 'Text', text: 'arrived late' }]),
    ]);
    assert.ok(findEl(container, (el) => el.textContent === 'arrived late'),
      'placeholder upgraded to its real component once the definition arrives');
    const siblingAfter = findEl(container, (el) => el.textContent === 'unchanged');
    assert.equal(siblingAfter, siblingBefore,
      'sibling is the SAME DOM node instance across the placeholder upgrade');
  });

  it('still reflects a changed static (non-databound) literal property', () => {
    const { adapter, container } = makeAdapter();
    adapter.processMessages([
      create(),
      update([{ id: 'root', component: 'Text', text: 'literal one' }]),
    ]);
    assert.ok(findEl(container, (el) => el.textContent === 'literal one'));
    adapter.processMessages([
      update([{ id: 'root', component: 'Text', text: 'literal two' }]),
    ]);
    assert.ok(findEl(container, (el) => el.textContent === 'literal two'),
      'resent literal value is reflected');
    assert.equal(findEl(container, (el) => el.textContent === 'literal one'), null,
      'stale literal value is gone');
  });

  it('does not stack watchers on repeated structural updates to the same live node', () => {
    let created = 0;
    const disposed = new Set();
    const countingWebCore = new Proxy(webCore, {
      get(target, prop) {
        if (prop !== 'effect') return target[prop];
        return (fn) => {
          created += 1;
          const stop = target.effect(fn);
          return () => { disposed.add(stop); stop(); };
        };
      },
    });
    const { adapter, container } = makeAdapter({ webCore: countingWebCore });
    adapter.processMessages([
      create(),
      update([
        { id: 'root', component: 'Column', children: ['t1'] },
        { id: 't1', component: 'Text', text: 'one' },
      ]),
    ]);

    const aliveCounts = [];
    for (let i = 0; i < 4; i += 1) {
      adapter.processMessages([
        update([
          { id: 'root', component: 'Column', children: ['t1', 't2'] },
          { id: 't2', component: 'Text', text: 'two' },
        ]),
      ]);
      adapter.processMessages([
        update([{ id: 'root', component: 'Column', children: ['t1'] }]),
      ]);
      aliveCounts.push(created - disposed.size);
    }
    assert.ok(findEl(container, (el) => el.textContent === 'one'));
    assert.equal(findEl(container, (el) => el.textContent === 'two'), null);
    // A stacking bug would grow this every round (one more surviving watcher
    // per repeat); a correctly-disposed design settles to a constant count
    // once back at the same tree shape.
    const steadyState = aliveCounts[0];
    for (const count of aliveCounts) {
      assert.equal(count, steadyState,
        `alive effect count must not grow across repeats: ${aliveCounts.join(', ')}`);
    }

    adapter.dispose();
    assert.equal(created, disposed.size,
      'every effect created over the adapter lifetime is eventually disposed');
  });
});

describe('action dispatch', () => {
  // Button has no `label` string prop in the real catalog (see
  // catalog/oat-catalog.json) — its content comes from a `child` component
  // ref, same as the "static rendering" describe block above.
  it('delivers event actions to onAction with dynamic values resolved', () => {
    const { adapter, container, actions } = makeAdapter();
    adapter.processMessages([
      create(),
      data('/cart', { total: 42 }),
      update([
        { id: 'root', component: 'Button', child: 'lbl',
          action: { event: { name: 'checkout',
                             context: { total: { path: '/cart/total' } } } } },
        { id: 'lbl', component: 'Text', text: 'Buy' },
      ]),
    ]);
    const btn = findEl(container, (el) => el.tagName === 'BUTTON');
    btn.dispatchEvent({ type: 'click', preventDefault() {} });
    assert.equal(actions.length, 1);
    // web_core's real A2uiClientActionSchema (schema/client-to-server.js) is
    // flat -- {name, surfaceId, sourceComponentId, timestamp, context} -- not
    // the {event: {name, context}} envelope the wire-level action carries.
    assert.equal(actions[0].name, 'checkout');
    assert.equal(actions[0].context.total, 42, 'binding resolved before dispatch');
  });

  // formatString (renderer/functions/formatString.js) is the registered
  // function used here: it writes its result through context.setDataModel,
  // making the side effect directly observable via surface.dataModel.get().
  // navigateTo (the plan's suggested example) was checked and rejected: its
  // real signature is (args.path, args.params) -- not (args.url,
  // args.targetPath) as drafted -- and it touches `window.history`/
  // `window.dispatchEvent`, neither of which the dom-shim provides.
  it('executes local functionCall actions without reaching onAction', () => {
    const { adapter, container, actions } = makeAdapter();
    adapter.processMessages([
      create(),
      data('/msg', 'before'),
      update([
        { id: 'root', component: 'Button', child: 'lbl',
          action: { functionCall: { call: 'formatString',
                                    args: { template: 'after', targetPath: '/msg' } } } },
        { id: 'lbl', component: 'Text', text: 'Nav' },
      ]),
    ]);
    const btn = findEl(container, (el) => el.tagName === 'BUTTON');
    btn.dispatchEvent({ type: 'click', preventDefault() {} });
    assert.equal(actions.length, 0, 'local call never reaches onAction');
    const surface = adapter.processor.model.getSurface('s1');
    assert.equal(surface.dataModel.get('/msg'), 'after',
      'formatString ran locally and wrote through context.setDataModel');
  });
});

describe('structural resolution', () => {
  it('expands a List template into one child per data item', () => {
    const { adapter, container } = makeAdapter();
    adapter.processMessages([
      create(),
      data('/items', [{ label: 'a' }, { label: 'b' }, { label: 'c' }]),
      update([
        { id: 'root', component: 'List',
          children: { componentId: 'itemTpl', path: '/items' } },
        { id: 'itemTpl', component: 'Text', text: { path: 'label' } },
      ]),
    ]);
    for (const t of ['a', 'b', 'c']) {
      assert.ok(findEl(container, (el) => el.textContent === t),
        `template item '${t}' rendered with item-scoped binding`);
    }
  });

  it('tracks template item additions', () => {
    const { adapter, container } = makeAdapter();
    adapter.processMessages([
      create(),
      data('/items', [{ label: 'a' }]),
      update([
        { id: 'root', component: 'List',
          children: { componentId: 'itemTpl', path: '/items' } },
        { id: 'itemTpl', component: 'Text', text: { path: 'label' } },
      ]),
    ]);
    adapter.processMessages([data('/items', [{ label: 'a' }, { label: 'b' }])]);
    assert.ok(findEl(container, (el) => el.textContent === 'b'));
  });

  // Regression test for a review finding: getDataModel() scoping a template
  // item to its own dataPath (fixing the relative-path case above) must not
  // break an ABSOLUTE path read from inside that same item's subtree.
  // OatRenderer's _getByPath has no real absolute/relative distinction of
  // its own -- it always strips a leading '/' and indexes into whatever
  // getDataModel() returns -- so both styles have to resolve out of one
  // object.
  it('resolves an absolute (root-anchored) binding alongside a relative (item-scoped) one inside the same template item', () => {
    const { adapter, container } = makeAdapter();
    adapter.processMessages([
      create(),
      data('/items', [{ label: 'a' }, { label: 'b' }]),
      data('/global', { msg: 'shared' }),
      update([
        { id: 'root', component: 'List',
          children: { componentId: 'itemTpl', path: '/items' } },
        // Each template item is a Row with two children: one bound to its
        // own item-relative field, one bound to a path outside the item's
        // own subtree entirely.
        { id: 'itemTpl', component: 'Row', children: ['tplLabel', 'tplGlobal'] },
        { id: 'tplLabel', component: 'Text', text: { path: 'label' } },
        { id: 'tplGlobal', component: 'Text', text: { path: '/global/msg' } },
      ]),
    ]);
    assert.ok(findEl(container, (el) => el.textContent === 'a'),
      'first item\'s relative binding still resolves');
    assert.ok(findEl(container, (el) => el.textContent === 'b'),
      'second item\'s relative binding still resolves');
    assert.equal(findAllEl(container, (el) => el.textContent === 'shared').length, 2,
      'absolute binding resolves via the surface root for every item, not just once');

    adapter.processMessages([data('/global/msg', 'shared2')]);
    assert.equal(findAllEl(container, (el) => el.textContent === 'shared2').length, 2,
      'absolute binding keeps resolving via the surface root after a data change');
    adapter.processMessages([data('/items/0/label', 'a2')]);
    assert.ok(findEl(container, (el) => el.textContent === 'a2'),
      'relative binding keeps resolving via its own item scope after a data change');
  });

  it('renders nested refs (Tabs items[].child) via the componentsModel fallback', () => {
    const { adapter, container } = makeAdapter();
    adapter.processMessages([
      create(),
      update([
        { id: 'root', component: 'Tabs',
          tabs: [{ title: 'One', child: 'p1' }, { title: 'Two', child: 'p2' }] },
        { id: 'p1', component: 'Text', text: 'panel one' },
        { id: 'p2', component: 'Text', text: 'panel two' },
      ]),
    ]);
    assert.ok(findEl(container, (el) => el.textContent === 'panel one'));
    assert.ok(findEl(container, (el) => el.textContent === 'panel two'));
  });

  it('renders the unknown-component fallback for a missing child (no throw)', () => {
    const { adapter, container, errors } = makeAdapter();
    adapter.processMessages([
      create(),
      update([{ id: 'root', component: 'Card', child: 'ghost' }]),
    ]);
    // 'ghost' never arrives: NodeResolver reports a pending placeholder.
    const fallback = findEl(container,
      (el) => el.dataset.unknownComponent !== undefined);
    assert.ok(fallback, 'placeholder rendered through OatRenderer fallback');
    assert.equal(errors.filter((e) => e instanceof TypeError).length, 0);
  });

  // The renderer's `_renderChecks`/`_evaluateCheck` contract (pinned by
  // tests/test-renderer.js's "Checkable / checks validation" describe block)
  // is `{ functionCall: { call, args }, message }` -- NOT the plan's
  // originally-drafted `{ condition: { call: { name, args } } }` shape.
  it('evaluates Checkable checks through the adapter (aria-invalid)', () => {
    const { adapter, container } = makeAdapter();
    adapter.processMessages([
      create(),
      data('/form', { email: '' }),
      update([{ id: 'root', component: 'TextField',
        label: 'Email', value: { path: '/form/email' },
        checks: [{ functionCall: { call: 'required',
                                    args: { value: { path: '/form/email' } } },
                   message: 'Email is required' }] }]),
    ]);
    const input = findEl(container, (el) => el.tagName === 'INPUT');
    assert.equal(input.getAttribute('aria-invalid'), 'true',
      'empty required field flagged invalid');
    adapter.processMessages([data('/form/email', 'a@b.co')]);
    assert.notEqual(input.getAttribute('aria-invalid'), 'true',
      'valid value clears aria-invalid');
  });
});

// oat-catalog.json's `theme` schema (see catalog/oat-catalog.json's top-level
// `theme` key) declares exactly these 7 properties: primaryColor,
// backgroundColor, textColor, fontFamily, borderRadius, spacing, mode --
// matching THEME_VARS's 6 CSS-variable entries in surface-adapter.js plus
// the separately-handled `mode` -> `data-theme` attribute. `theme` itself
// flows from `createSurface.theme` straight into `SurfaceModel.theme`
// unvalidated (message-processor.js's processCreateSurfaceMessage destructures
// it directly into `new SurfaceModel(surfaceId, catalog, theme, ...)`), so
// the adapter's applyTheme() is the only place that shape is consumed.
describe('theme, deletion, disposal', () => {
  it('applies createSurface theme to the surface element', () => {
    const { adapter, container } = makeAdapter();
    adapter.processMessages([
      create('s1', { theme: { primaryColor: '#ff0000', mode: 'dark' } }),
      update([{ id: 'root', component: 'Text', text: 'themed' }]),
    ]);
    const surfaceEl = findEl(container, (el) => el.dataset.surfaceId === 's1');
    assert.equal(surfaceEl.style.getPropertyValue('--color-primary'), '#ff0000');
    assert.equal(surfaceEl.getAttribute('data-theme'), 'dark');
  });

  // Verified against real source: MessageProcessor.onSurfaceDeleted
  // (processing/message-processor.js) is a thin passthrough to
  // `this.model.onSurfaceDeleted` (state/surface-group-model.js) -- the exact
  // same EventEmitter `processor.model.onSurfaceDeleted` exposes, not a
  // distinct one -- so hooking either is equivalent; the adapter's existing
  // `processor.onSurfaceDeleted(...)` subscription already fires correctly.
  // SurfaceGroupModel.deleteSurface() also confirms the ordering the brief
  // flagged as ambiguous: it deletes from `this.surfaces`, calls
  // `surface.dispose()` (which disposes dataModel/componentsModel/action
  // emitters WITHOUT emitting per-component onDeleted events -- see
  // SurfaceComponentsModel.dispose(), which clears its listener sets instead
  // of firing them), and only THEN emits `onSurfaceDeleted`. So by the time
  // this fires, the surface's model data is already torn down, but nothing
  // in the emit path depends on it still being present -- unmountSurface only
  // touches the adapter's own `mounted` entry (resolver/effect/DOM).
  it('removes the surface DOM on deleteSurface', () => {
    const { adapter, container } = makeAdapter();
    adapter.processMessages([create(), update([
      { id: 'root', component: 'Text', text: 'bye' }])]);
    adapter.processMessages([{ version: V, deleteSurface: { surfaceId: 's1' } }]);
    assert.equal(findEl(container, (el) => el.dataset.surfaceId === 's1'), null);
  });

  it('dispose() tears everything down', () => {
    const { adapter, container } = makeAdapter();
    adapter.processMessages([
      create(),
      data('/x', 1),
      update([
        { id: 'root', component: 'Column', children: ['t1'] },
        { id: 't1', component: 'Text', text: { path: '/x' } },
      ]),
    ]);
    adapter.dispose();
    assert.equal(findEl(container, (el) => el.dataset.surfaceId === 's1'), null,
      'surface DOM removed');
    // data updates after dispose must not touch the old DOM or throw: the
    // adapter's own resolver/effect are gone, even though the underlying
    // processor/SurfaceModel (a separate layer -- dispose() only tears down
    // the adapter's rendering side, not the wire-protocol model) still
    // accepts the message.
    adapter.processMessages([data('/x', 2)]);
  });

  // Verified against real source: NodeResolver.dispose() (nodes/node-resolver.js)
  // disposes every node bottom-up (children before their parent, via
  // disposeNode's recursion over childEdges) and each MutableComponentNode.dispose()
  // (nodes/component-node.js) runs ALL of its accumulated `cleanups` --
  // idempotently and in a try/catch per cleanup -- before emitting
  // onDestroyed. The adapter's unmountSurface() stops the surface-level
  // `stopEffect` (tracking resolver.rootNode) BEFORE calling
  // `resolver.dispose()`, so no per-node `watchNode` effect can be triggered
  // by the resolver's own teardown (e.g. its final `setValue(rootNode,
  // undefined)`) after the fact.
  it('does not accumulate subscriptions on repeated bound-value updates, but still disposes a genuinely superseded one', () => {
    // Post-Critical-#1-fix characteristic: watchNode's persistent per-node
    // effect only rebuilds the element (renderOnce + replaceWith) for a
    // STRUCTURAL change (a ref-field swap, a placeholder->resolved upgrade,
    // or a resent static-literal property) -- not for a plain bound-value
    // change delivered via `updateDataModel`, which now leaves the element
    // alone and lets `context.subscribe()` patch it in place (see
    // `watchNode`'s docstring in surface-adapter.js). So repeatedly changing
    // the SAME bound value must NOT create additional
    // `DataContext.subscribeDynamicValue()` subscriptions -- there is
    // exactly one, created by the single `renderOnce` call, for the whole
    // run of value-only updates. A genuine structural resend (a fresh
    // `updateComponents` for this id) still rebuilds, still creates a fresh
    // subscription via a fresh `context.subscribe()`, and still leaves the
    // PREVIOUS render's now-orphaned subscription un-unsubscribed until the
    // node itself is disposed (only bulk-cleaned via `node.addCleanup`) --
    // that narrower, still-real leak (deferred items #4/#5 in the final
    // review) is what this test's second half exercises. This spies on
    // `DataContext.subscribeDynamicValue` (not `webCore.effect`: that
    // function is called through a direct internal module import inside
    // data-context.js, not through the `webCore` namespace object the
    // adapter holds, so wrapping `webCore.effect` -- as the "does not stack
    // watchers" test above does for the adapter's OWN effects -- would not
    // observe these).
    const original = webCore.DataContext.prototype.subscribeDynamicValue;
    let created = 0;
    let unsubscribed = 0;
    webCore.DataContext.prototype.subscribeDynamicValue = function (...args) {
      created += 1;
      const sub = original.apply(this, args);
      let done = false;
      return {
        get value() { return sub.value; },
        unsubscribe: () => {
          if (!done) { done = true; unsubscribed += 1; }
          sub.unsubscribe();
        },
      };
    };
    try {
      const { adapter, container } = makeAdapter();
      adapter.processMessages([
        create(),
        data('/x', 'v1'),
        update([{ id: 'root', component: 'Text', text: { path: '/x' } }]),
      ]);
      assert.ok(findEl(container, (el) => el.textContent === 'v1'));
      const createdAfterInitialRender = created;
      for (let i = 2; i <= 5; i += 1) {
        adapter.processMessages([data('/x', `v${i}`)]);
      }
      assert.ok(findEl(container, (el) => el.textContent === 'v5'),
        'latest value rendered');
      assert.equal(created, createdAfterInitialRender,
        `bound-value-only updates must not create additional subscriptions ` +
        `(created ${createdAfterInitialRender} at initial render, ${created} ` +
        `after 4 more value-only updates)`);

      // A genuine structural resend (same id, fresh updateComponents) still
      // rebuilds and still creates one more subscription, orphaning the
      // previous render's -- the narrower, still-accepted characteristic.
      adapter.processMessages([
        update([{ id: 'root', component: 'Text', text: { path: '/x' } }]),
      ]);
      assert.equal(created, createdAfterInitialRender + 1,
        'a resent component definition still triggers exactly one more rebuild/subscribe');
      assert.ok(created > unsubscribed,
        `the superseded render's subscription is not proactively unsubscribed ` +
        `(observed ${created} created vs ${unsubscribed} unsubscribed before dispose)`);

      adapter.dispose();
      assert.equal(created, unsubscribed,
        'every subscription created over the node\'s lifetime -- including ' +
        'the one from the superseded, already-replaced render -- is unsubscribed ' +
        'once dispose() tears the node down; none are leaked');
    } finally {
      webCore.DataContext.prototype.subscribeDynamicValue = original;
    }
  });

  // Verified against real source: MessageProcessor.processCreateSurfaceMessage
  // (processing/message-processor.js) throws A2uiStateError synchronously
  // ("Catalog not found: ...") BEFORE calling `this.model.addSurface(...)` --
  // so `onSurfaceCreated` never fires and `mountSurface` never runs. The
  // adapter's own `processMessages` wraps `processor.processMessages(...)` in
  // try/catch -> onError, so this never throws back to the caller and never
  // leaves a half-mounted surface element behind.
  it('routes renderer exceptions to onError without breaking the surface', () => {
    const { adapter, container, errors } = makeAdapter();
    adapter.processMessages([
      { version: V, createSurface: { surfaceId: 'sX', catalogId: 'urn:nope' } },
    ]);
    assert.equal(errors.length, 1, 'the create-surface failure is routed to onError');
    assert.match(errors[0].message, /urn:nope/);
    assert.equal(findEl(container, (el) => el.dataset.surfaceId === 'sX'), null,
      'no half-mounted surface element left behind');
    // The adapter itself must still be usable afterwards.
    adapter.processMessages([create('s1'), update([
      { id: 'root', component: 'Text', text: 'still works' }])]);
    assert.ok(findEl(container, (el) => el.textContent === 'still works'));
  });
});
