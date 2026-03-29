/**
 * Tests for catalog schema integrity and cross-references.
 * Uses Node.js built-in test runner — zero dependencies.
 *
 * Run: node --test tests/test-catalog.js
 */

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const catalog = JSON.parse(readFileSync(join(root, 'catalog', 'oat-catalog.json'), 'utf-8'));
const components = catalog.components;
const functions = catalog.functions;

// ── Catalog structure ─────────────────────────────────────────────────────────

describe('catalog top-level structure', () => {
  it('has $schema pointing to a2ui.org', () => {
    assert.ok(catalog.$schema.includes('a2ui.org'));
  });
  it('has a catalogId', () => {
    assert.ok(catalog.catalogId);
  });
  it('is version v0.9', () => {
    assert.equal(catalog.version, 'v0.9');
  });
  it('has a name and description', () => {
    assert.ok(catalog.name);
    assert.ok(catalog.description);
  });
});

// ── Components ────────────────────────────────────────────────────────────────

describe('components', () => {
  const componentNames = Object.keys(components);

  it('has 37 components', () => {
    assert.equal(componentNames.length, 37);
  });

  it('includes all 16 Basic Catalog components', () => {
    const basic = [
      'Row', 'Column', 'Text', 'Image', 'Icon', 'Divider', 'Button',
      'TextField', 'CheckBox', 'Slider', 'DateTimeInput', 'ChoicePicker',
      'Card', 'Modal', 'Tabs', 'List',
    ];
    for (const name of basic) {
      assert.ok(components[name], `Missing Basic Catalog component: ${name}`);
    }
  });

  for (const name of componentNames) {
    describe(`component: ${name}`, () => {
      const comp = components[name];

      it('has a description', () => {
        assert.ok(comp.description, `${name} missing description`);
      });
      it('has an htmlElement', () => {
        assert.ok(comp.htmlElement, `${name} missing htmlElement`);
      });
      it('has properties object', () => {
        assert.equal(typeof comp.properties, 'object', `${name} missing properties`);
      });
      it('has requiredProperties array', () => {
        assert.ok(Array.isArray(comp.requiredProperties), `${name} missing requiredProperties`);
      });
      it('all requiredProperties exist in properties', () => {
        for (const req of comp.requiredProperties) {
          assert.ok(comp.properties[req], `${name}: required property "${req}" not in properties`);
        }
      });
    });
  }
});

// ── Functions ─────────────────────────────────────────────────────────────────

describe('functions', () => {
  const functionNames = Object.keys(functions);

  it('has 21 registered functions', () => {
    assert.equal(functionNames.length, 21);
  });

  for (const name of functionNames) {
    describe(`function: ${name}`, () => {
      const fn = functions[name];

      it('has a description', () => {
        assert.ok(fn.description, `${name} missing description`);
      });
      it('has parameters object', () => {
        assert.equal(typeof fn.parameters, 'object', `${name} missing parameters`);
      });
      it('has requiredParameters array', () => {
        assert.ok(Array.isArray(fn.requiredParameters), `${name} missing requiredParameters`);
      });
    });
  }
});

// ── Cross-references ──────────────────────────────────────────────────────────

describe('function implementation cross-reference', () => {
  const fnDir = join(root, 'renderer', 'functions');
  const fnFiles = readdirSync(fnDir).filter(f => f.endsWith('.js')).map(f => f.replace('.js', ''));
  const functionNames = Object.keys(functions);

  for (const name of functionNames) {
    it(`${name} has a JS implementation`, () => {
      assert.ok(fnFiles.includes(name), `Missing implementation: renderer/functions/${name}.js`);
    });
  }
});

describe('function schema cross-reference', () => {
  const schemaDir = join(root, 'catalog', 'functions');
  const schemaFiles = readdirSync(schemaDir).filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
  const functionNames = Object.keys(functions);

  for (const name of functionNames) {
    it(`${name} has a JSON schema`, () => {
      assert.ok(schemaFiles.includes(name), `Missing schema: catalog/functions/${name}.json`);
    });
  }
});

// ── Theme ─────────────────────────────────────────────────────────────────────

describe('theme', () => {
  it('has theme properties', () => {
    assert.ok(catalog.theme);
    assert.ok(Object.keys(catalog.theme).length >= 5);
  });

  it('theme properties have cssVariable mappings (except mode)', () => {
    for (const [name, def] of Object.entries(catalog.theme)) {
      if (name !== 'mode') {
        assert.ok(def.cssVariable, `Theme property "${name}" missing cssVariable`);
      }
    }
  });
});
