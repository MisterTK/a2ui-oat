#!/usr/bin/env node

/**
 * Validates oat-catalog.json against A2UI v0.9 structural requirements
 * and cross-references renderer + function implementations.
 *
 * Usage: node scripts/validate-catalog.js
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

let passed = 0;
let failed = 0;
let warnings = 0;

function pass(msg) { passed++; console.log(`  ✅ ${msg}`); }
function fail(msg) { failed++; console.log(`  ❌ ${msg}`); }
function warn(msg) { warnings++; console.log(`  ⚠️  ${msg}`); }
function section(msg) { console.log(`\n${msg}`); }

// ── Load catalog ──────────────────────────────────────────────

section('1. Loading catalog');

const catalogPath = join(root, 'catalog', 'oat-catalog.json');
let catalog;
try {
  catalog = JSON.parse(readFileSync(catalogPath, 'utf-8'));
  pass('catalog/oat-catalog.json is valid JSON');
} catch (e) {
  fail(`catalog/oat-catalog.json parse error: ${e.message}`);
  process.exit(1);
}

// ── Top-level structure ───────────────────────────────────────

section('2. Top-level structure');

const requiredTopLevel = ['$schema', 'catalogId', 'version', 'name', 'description', 'components'];
for (const key of requiredTopLevel) {
  if (catalog[key] !== undefined) {
    pass(`Top-level "${key}" present`);
  } else {
    fail(`Top-level "${key}" missing`);
  }
}

if (catalog.$schema) {
  if (catalog.$schema.includes('a2ui.org')) {
    pass(`$schema references a2ui.org: ${catalog.$schema}`);
  } else {
    warn(`$schema does not reference a2ui.org: ${catalog.$schema}`);
  }
}

if (catalog.version === 'v0.9') {
  pass('Version is v0.9');
} else {
  warn(`Version is "${catalog.version}", expected "v0.9"`);
}

// ── Components ────────────────────────────────────────────────

section('3. Component validation');

const components = catalog.components || {};
const componentNames = Object.keys(components);
console.log(`   Found ${componentNames.length} components`);

const componentRequiredKeys = ['description', 'htmlElement', 'properties', 'requiredProperties'];
let componentErrors = 0;

for (const name of componentNames) {
  const comp = components[name];
  for (const key of componentRequiredKeys) {
    if (comp[key] === undefined) {
      fail(`Component "${name}" missing "${key}"`);
      componentErrors++;
    }
  }

  if (comp.properties && typeof comp.properties === 'object') {
    for (const [propName, propDef] of Object.entries(comp.properties)) {
      if (!propDef.type && !propDef.$ref) {
        warn(`Component "${name}" property "${propName}" has no type`);
      }
      if (!propDef.description) {
        warn(`Component "${name}" property "${propName}" has no description`);
      }
    }
  }

  if (comp.requiredProperties && !Array.isArray(comp.requiredProperties)) {
    fail(`Component "${name}" requiredProperties is not an array`);
    componentErrors++;
  }
}

if (componentErrors === 0) {
  pass(`All ${componentNames.length} components have required keys (description, htmlElement, properties, requiredProperties)`);
}

// Basic Catalog coverage check (A2UI v0.9 Basic Catalog components)
const basicCatalog = [
  'Row', 'Column', 'Text', 'Image', 'Icon', 'Divider', 'Button',
  'TextField', 'CheckBox', 'Slider', 'DateTimeInput', 'ChoicePicker',
  'Card', 'Modal', 'Tabs', 'List'
];
const missingBasic = basicCatalog.filter(c => !components[c]);
if (missingBasic.length === 0) {
  pass(`All 16 Basic Catalog components present`);
} else {
  fail(`Missing Basic Catalog components: ${missingBasic.join(', ')}`);
}

// ── Functions ─────────────────────────────────────────────────

section('4. Function validation');

const functions = catalog.functions || {};
const functionNames = Object.keys(functions);
console.log(`   Found ${functionNames.length} registered functions`);

const functionRequiredKeys = ['description', 'parameters', 'requiredParameters'];
let functionErrors = 0;

for (const name of functionNames) {
  const fn = functions[name];
  for (const key of functionRequiredKeys) {
    if (fn[key] === undefined) {
      fail(`Function "${name}" missing "${key}"`);
      functionErrors++;
    }
  }
}

if (functionErrors === 0) {
  pass(`All ${functionNames.length} functions have required keys (description, parameters, requiredParameters)`);
}

// ── Theme ─────────────────────────────────────────────────────

section('5. Theme validation');

if (catalog.theme) {
  const themeProps = Object.keys(catalog.theme);
  pass(`Theme section present with ${themeProps.length} properties`);

  for (const [name, def] of Object.entries(catalog.theme)) {
    if (!def.cssVariable) {
      warn(`Theme property "${name}" has no cssVariable mapping`);
    }
  }
} else {
  warn('No theme section (optional but recommended)');
}

// ── Cross-reference: renderer implementations ─────────────────

section('6. Renderer cross-reference');

const rendererPath = join(root, 'renderer', 'oat-renderer.js');
if (existsSync(rendererPath)) {
  const rendererSrc = readFileSync(rendererPath, 'utf-8');

  // Extract renderer registrations (this.renderers.set('Name', ...))
  const renderMethodPattern = /this\.renderers\.set\(['"](\w+)['"]/g;
  const registeredRenderers = new Set();
  let match;
  while ((match = renderMethodPattern.exec(rendererSrc)) !== null) {
    registeredRenderers.add(match[1]);
  }

  const missingRenderers = componentNames.filter(c => !registeredRenderers.has(c));
  const extraRenderers = [...registeredRenderers].filter(r => !components[r]);

  if (missingRenderers.length === 0) {
    pass(`All ${componentNames.length} catalog components have renderer implementations`);
  } else {
    fail(`Components missing renderer: ${missingRenderers.join(', ')}`);
  }

  if (extraRenderers.length > 0) {
    warn(`Renderer has implementations for non-catalog components: ${extraRenderers.join(', ')}`);
  }
} else {
  warn('renderer/oat-renderer.js not found, skipping renderer cross-reference');
}

// ── Cross-reference: function implementations ─────────────────

section('7. Function implementation cross-reference');

const fnDir = join(root, 'renderer', 'functions');
if (existsSync(fnDir)) {
  const fnFiles = readdirSync(fnDir).filter(f => f.endsWith('.js')).map(f => f.replace('.js', ''));
  const missingImpl = functionNames.filter(f => !fnFiles.includes(f));
  const extraImpl = fnFiles.filter(f => !functions[f] && f !== 'fetchBase'); // fetchBase is shared utility

  if (missingImpl.length === 0) {
    pass(`All ${functionNames.length} catalog functions have JS implementations`);
  } else {
    fail(`Functions missing implementation: ${missingImpl.join(', ')}`);
  }

  if (extraImpl.length > 0) {
    warn(`Extra function files without catalog entry: ${extraImpl.join(', ')}`);
  }
} else {
  warn('renderer/functions/ not found, skipping function cross-reference');
}

// ── Cross-reference: function JSON schemas ────────────────────

section('8. Function schema cross-reference');

const schemaDir = join(root, 'catalog', 'functions');
if (existsSync(schemaDir)) {
  const schemaFiles = readdirSync(schemaDir).filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
  const missingSchema = functionNames.filter(f => !schemaFiles.includes(f));
  const extraSchema = schemaFiles.filter(f => !functions[f]);

  if (missingSchema.length === 0) {
    pass(`All ${functionNames.length} catalog functions have JSON schemas in catalog/functions/`);
  } else {
    fail(`Functions missing JSON schema: ${missingSchema.join(', ')}`);
  }

  if (extraSchema.length > 0) {
    warn(`Extra schema files without catalog entry: ${extraSchema.join(', ')}`);
  }
} else {
  warn('catalog/functions/ not found, skipping schema cross-reference');
}

// ── Summary ───────────────────────────────────────────────────

section('═══ Summary ═══');
console.log(`  Passed:   ${passed}`);
console.log(`  Failed:   ${failed}`);
console.log(`  Warnings: ${warnings}`);
console.log();

if (failed > 0) {
  console.log('❌ Validation FAILED');
  process.exit(1);
} else {
  console.log('✅ Validation PASSED');
  process.exit(0);
}
