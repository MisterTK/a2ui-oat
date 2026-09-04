/**
 * Tests for the real @a2ui/web_core surface adapter.
 * Runs against the actual published package (devDependency), not a mock.
 */
import { describe, it, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { installDomShim, findEl } from './helpers/dom-shim.js';

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
    assert.equal(before.textContent, 'Grace', 'same element updated in place');
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
