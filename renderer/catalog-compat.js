/**
 * catalog-compat — transforms catalog/oat-catalog.json into the raw-schema
 * format @a2ui/web_core's Catalog.fromSchema() understands.
 *
 * oat-catalog.json uses a compact vocabulary ("type": "ChildList",
 * "ComponentId", "DynamicString", ...). web_core's schema loader recognizes
 * only standard JSON-schema types plus $refs to
 * "common_types.json#/$defs/<Name>". Without this mapping, NodeResolver
 * cannot detect child-reference properties and MessageProcessor's strict
 * property validation (web_core >= 0.10.6) rejects data-bound values.
 *
 * @module catalog-compat
 */

/** Oat-catalog custom types → protocol $defs names. */
const PROTOCOL_REFS = {
  ChildList: 'ChildList',
  ComponentId: 'ComponentId',
  Action: 'Action',
  DynamicString: 'DynamicString',
  DynamicNumber: 'DynamicNumber',
  DynamicBoolean: 'DynamicBoolean',
  Dynamic: 'DynamicValue',
  CheckRule: 'CheckRule',
};

/** Plain primitives that agents may data-bind → Dynamic* equivalents. */
const BINDABLE_PRIMITIVES = {
  string: 'DynamicString',
  boolean: 'DynamicBoolean',
  number: 'DynamicNumber',
  integer: 'DynamicNumber',
};

const STANDARD_JSON_TYPES = new Set([
  'string', 'number', 'integer', 'boolean', 'object', 'array', 'null',
]);

function refSchema(name, description) {
  const out = { $ref: `common_types.json#/$defs/${name}` };
  if (description) out.description = description;
  return out;
}

function transformProperty(prop) {
  if (!prop || typeof prop !== 'object') return prop;
  const { type, description } = prop;

  // Enums stay literal-validated (matches web_core's own basic catalog).
  if (Array.isArray(prop.enum)) return prop;

  const custom = PROTOCOL_REFS[type];
  if (custom) return refSchema(custom, description);

  const bindable = BINDABLE_PRIMITIVES[type];
  if (bindable) return refSchema(bindable, description);

  // Arrays/objects: the loader cannot express "typed value OR binding OR
  // nested component ids", so relax to a permissive schema; the renderer
  // resolves and interprets these values itself.
  if (type === 'array' || type === 'object') {
    return description ? { description } : {};
  }

  return prop;
}

/**
 * Transform oat-catalog JSON into web_core Catalog.fromSchema() input.
 * Pure: returns a new object, never mutates the input.
 *
 * @param {object} catalogJson - Parsed contents of catalog/oat-catalog.json.
 * @returns {object} Loader-compatible catalog schema object.
 */
export function toWebCoreCatalogJson(catalogJson) {
  const out = structuredClone(catalogJson);

  for (const comp of Object.values(out.components ?? {})) {
    if (!comp.properties) continue;
    for (const [name, prop] of Object.entries(comp.properties)) {
      comp.properties[name] = transformProperty(prop);
    }
  }

  const functions = {};
  for (const [name, fn] of Object.entries(out.functions ?? {})) {
    const properties = {};
    for (const [param, schema] of Object.entries(fn.parameters ?? {})) {
      if (schema && typeof schema === 'object'
          && schema.type && !STANDARD_JSON_TYPES.has(schema.type)) {
        // Custom vocab in function params (e.g. DynamicString) → permissive.
        const { type, ...rest } = schema;
        properties[param] = rest;
      } else {
        properties[param] = schema;
      }
    }
    functions[name] = {
      description: fn.description,
      returnType: fn.returnType ?? 'any',
      args: {
        type: 'object',
        properties,
        required: fn.requiredParameters ?? [],
      },
    };
  }
  out.functions = functions;

  return out;
}
