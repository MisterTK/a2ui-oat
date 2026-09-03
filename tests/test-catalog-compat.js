/**
 * Tests for catalog-compat — transforms oat-catalog.json into the format
 * @a2ui/web_core's Catalog.fromSchema() understands.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { toWebCoreCatalogJson } from '../renderer/catalog-compat.js';
import * as webCore from '@a2ui/web_core/v0_9';
import catalogJson from '../catalog/oat-catalog.json' with { type: 'json' };

describe('toWebCoreCatalogJson', () => {
  it('maps ChildList and ComponentId to protocol $refs', () => {
    const out = toWebCoreCatalogJson(catalogJson);
    assert.equal(out.components.Row.properties.children.$ref,
      'common_types.json#/$defs/ChildList');
    assert.equal(out.components.Row.properties.children.type, undefined);
    assert.equal(out.components.Card.properties.child.$ref,
      'common_types.json#/$defs/ComponentId');
  });

  it('maps Dynamic*, Action, and bindable primitives to protocol $refs', () => {
    const out = toWebCoreCatalogJson(catalogJson);
    assert.equal(out.components.Text.properties.text.$ref,
      'common_types.json#/$defs/DynamicString');
    assert.equal(out.components.Button.properties.action.$ref,
      'common_types.json#/$defs/Action');
    // plain boolean → DynamicBoolean so {path} bindings pass validation
    assert.equal(out.components.TextField.properties.disabled.$ref,
      'common_types.json#/$defs/DynamicBoolean');
  });

  it('keeps enum properties literal-validated', () => {
    const out = toWebCoreCatalogJson(catalogJson);
    assert.deepEqual(out.components.Row.properties.justify.enum,
      catalogJson.components.Row.properties.justify.enum);
  });

  it('relaxes array and object properties to permissive schemas', () => {
    const out = toWebCoreCatalogJson(catalogJson);
    // Tabs.tabs is an array of {title, child}; bindings and nested refs must
    // survive strict validation, so the transform drops the type constraint.
    assert.equal(out.components.Tabs.properties.tabs.type, undefined);
    assert.equal(out.components.Tabs.properties.tabs.$ref, undefined);
  });

  it('does not mutate its input', () => {
    const before = JSON.stringify(catalogJson);
    toWebCoreCatalogJson(catalogJson);
    assert.equal(JSON.stringify(catalogJson), before);
  });

  it('re-shapes functions into the loader format', () => {
    const out = toWebCoreCatalogJson(catalogJson);
    const fd = out.functions.formatDate;
    assert.equal(fd.args.type, 'object');
    assert.ok(fd.args.properties);
    assert.deepEqual(fd.args.required,
      catalogJson.functions.formatDate.requiredParameters ?? []);
    assert.equal(fd.returnType, 'any');
  });

  it('produces a catalog whose child refs web_core detects', () => {
    const cat = webCore.Catalog.fromSchema(toWebCoreCatalogJson(catalogJson));
    assert.equal(cat.id, catalogJson.catalogId);
    assert.equal(cat.components.size,
      Object.keys(catalogJson.components).length);
    const rowRefs = webCore.extractRefFields(cat.components.get('Row').schema);
    assert.equal(rowRefs.get('children')?.kind, 'list');
    const cardRefs = webCore.extractRefFields(cat.components.get('Card').schema);
    assert.equal(cardRefs.get('child')?.kind, 'single');
  });

  it('validates both literal and binding values for dynamic props', () => {
    const cat = webCore.Catalog.fromSchema(toWebCoreCatalogJson(catalogJson));
    const tf = cat.components.get('TextField').schema;
    assert.ok(tf.safeParse({ label: 'Name', value: 'literal' }).success);
    assert.ok(tf.safeParse({ label: 'Name', value: { path: '/user/name' } }).success);
    assert.ok(tf.safeParse({ label: 'Name', disabled: { path: '/locked' } }).success);
  });
});
