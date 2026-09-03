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
