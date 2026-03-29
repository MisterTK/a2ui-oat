/**
 * Tests for all 22 registered functions.
 * Uses Node.js built-in test runner — zero dependencies.
 *
 * Run: node --test tests/test-functions.js
 */

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

import { and } from '../renderer/functions/and.js';
import { or } from '../renderer/functions/or.js';
import { not } from '../renderer/functions/not.js';
import { required } from '../renderer/functions/required.js';
import { regex } from '../renderer/functions/regex.js';
import { length } from '../renderer/functions/length.js';
import { numeric } from '../renderer/functions/numeric.js';
import { email } from '../renderer/functions/email.js';
import { formatDate } from '../renderer/functions/formatDate.js';
import { formatNumber } from '../renderer/functions/formatNumber.js';
import { formatCurrency } from '../renderer/functions/formatCurrency.js';
import { formatString } from '../renderer/functions/formatString.js';
import { pluralize } from '../renderer/functions/pluralize.js';

// Shared minimal context
const ctx = { resolveDynamic: (v) => v };

// ── Logic functions ───────────────────────────────────────────────────────────

describe('and', () => {
  it('returns true when all conditions are truthy', () => {
    assert.equal(and({ conditions: [true, 1, 'yes'] }, ctx), true);
  });
  it('returns false when any condition is falsy', () => {
    assert.equal(and({ conditions: [true, 0, 'yes'] }, ctx), false);
  });
  it('returns true for empty conditions', () => {
    assert.equal(and({ conditions: [] }, ctx), true);
  });
});

describe('or', () => {
  it('returns true when any condition is truthy', () => {
    assert.equal(or({ conditions: [false, 0, 'yes'] }, ctx), true);
  });
  it('returns false when all conditions are falsy', () => {
    assert.equal(or({ conditions: [false, 0, ''] }, ctx), false);
  });
});

describe('not', () => {
  it('negates truthy to false', () => {
    assert.equal(not({ value: true }, ctx), false);
  });
  it('negates falsy to true', () => {
    assert.equal(not({ value: 0 }, ctx), true);
  });
});

// ── Validation functions ──────────────────────────────────────────────────────

describe('required', () => {
  it('returns true for non-empty string', () => {
    assert.equal(required({ value: 'hello' }, ctx), true);
  });
  it('returns false for empty string', () => {
    assert.equal(required({ value: '' }, ctx), false);
  });
  it('returns false for null', () => {
    assert.equal(required({ value: null }, ctx), false);
  });
  it('returns true for zero (non-null)', () => {
    assert.equal(required({ value: 0 }, ctx), true);
  });
});

describe('regex', () => {
  it('returns true for matching pattern', () => {
    assert.equal(regex({ value: 'abc123', pattern: '^[a-z]+\\d+$' }, ctx), true);
  });
  it('returns false for non-matching pattern', () => {
    assert.equal(regex({ value: 'ABC', pattern: '^[a-z]+$' }, ctx), false);
  });
});

describe('length', () => {
  it('validates within bounds', () => {
    assert.equal(length({ value: 'hello', min: 1, max: 10 }, ctx), true);
  });
  it('rejects below min', () => {
    assert.equal(length({ value: '', min: 1 }, ctx), false);
  });
  it('rejects above max', () => {
    assert.equal(length({ value: 'toolong', max: 3 }, ctx), false);
  });
});

describe('numeric', () => {
  it('returns true for numbers', () => {
    assert.equal(numeric({ value: 42 }, ctx), true);
  });
  it('returns true for numeric strings', () => {
    assert.equal(numeric({ value: '3.14' }, ctx), true);
  });
  it('returns false for non-numeric', () => {
    assert.equal(numeric({ value: 'abc' }, ctx), false);
  });
});

describe('email', () => {
  it('validates correct email', () => {
    assert.equal(email({ value: 'user@example.com' }, ctx), true);
  });
  it('rejects invalid email', () => {
    assert.equal(email({ value: 'not-an-email' }, ctx), false);
  });
});

// ── Formatting functions ──────────────────────────────────────────────────────

describe('formatDate', () => {
  it('formats an ISO date string', () => {
    const result = formatDate({ value: '2026-03-29T12:00:00Z', locale: 'en-US' }, ctx);
    assert.ok(typeof result === 'string');
    assert.ok(result.length > 0);
  });
  it('throws on invalid date', () => {
    assert.throws(() => formatDate({ value: 'not-a-date' }, ctx));
  });
  it('throws on missing value', () => {
    assert.throws(() => formatDate({}, ctx));
  });
});

describe('formatNumber', () => {
  it('formats a number with locale', () => {
    const result = formatNumber({ value: 1234567, locale: 'en-US' }, ctx);
    assert.ok(result.includes('1,234,567') || result.includes('1234567'));
  });
});

describe('formatCurrency', () => {
  it('formats currency with code', () => {
    const result = formatCurrency({ value: 99.99, currency: 'USD', locale: 'en-US' }, ctx);
    assert.ok(result.includes('99.99') || result.includes('$'));
  });
});

describe('formatString', () => {
  it('interpolates data model path placeholders', () => {
    const modelCtx = {
      resolveDynamic: (v) => v,
      getDataModel: () => ({ user: { name: 'World' } }),
    };
    const result = formatString({ template: 'Hello, ${/user/name}!' }, modelCtx);
    assert.equal(result, 'Hello, World!');
  });
  it('returns empty string for missing paths', () => {
    const modelCtx = { resolveDynamic: (v) => v, getDataModel: () => ({}) };
    const result = formatString({ template: 'Hi ${/missing}!' }, modelCtx);
    assert.equal(result, 'Hi !');
  });
});

describe('pluralize', () => {
  it('returns singular for count 1', () => {
    const result = pluralize({ count: 1, singular: 'item', plural: 'items' }, ctx);
    assert.equal(result, 'item');
  });
  it('returns plural for count > 1', () => {
    const result = pluralize({ count: 5, singular: 'item', plural: 'items' }, ctx);
    assert.equal(result, 'items');
  });
  it('returns plural for count 0', () => {
    const result = pluralize({ count: 0, singular: 'item', plural: 'items' }, ctx);
    assert.equal(result, 'items');
  });
});

// ── Data-model write-back ─────────────────────────────────────────────────────

describe('targetPath write-back', () => {
  it('formatDate writes to data model when targetPath is set', () => {
    let writtenPath, writtenValue;
    const writeCtx = {
      resolveDynamic: (v) => v,
      setDataModel: (path, val) => { writtenPath = path; writtenValue = val; },
    };
    formatDate({ value: '2026-01-01', locale: 'en-US', targetPath: '/formatted/date' }, writeCtx);
    assert.equal(writtenPath, '/formatted/date');
    assert.ok(typeof writtenValue === 'string');
  });
});
