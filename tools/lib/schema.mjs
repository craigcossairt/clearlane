// A small JSON Schema subset validator, so contract tests need no runtime dependency.
// Supports: type (string|number|integer|boolean|object|array, or a list), const, enum, pattern,
// required, properties, additionalProperties: false, items, minItems, maxItems, minimum.
// Returns a list of "<json pointer>: <problem>" strings; empty means valid.

const typeOf = (v) =>
  v === null
    ? "null"
    : Array.isArray(v)
      ? "array"
      : Number.isInteger(v)
        ? "integer"
        : typeof v;

const typeMatches = (want, v) => {
  const got = typeOf(v);
  return got === want || (want === "number" && got === "integer");
};

/** @param {any} schema @param {unknown} value @param {string} [at] @returns {string[]} */
export function validate(schema, value, at = "") {
  const errs = [];
  const here = at || "/";
  if (schema.type) {
    const wants = [].concat(schema.type);
    if (!wants.some((w) => typeMatches(w, value))) {
      return [`${here}: expected ${wants.join(" or ")}, got ${typeOf(value)}`];
    }
  }
  if ("const" in schema && value !== schema.const)
    errs.push(`${here}: expected ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value))
    errs.push(`${here}: not one of ${JSON.stringify(schema.enum)}`);
  if (
    schema.pattern &&
    typeof value === "string" &&
    !new RegExp(schema.pattern).test(value)
  ) {
    errs.push(`${here}: does not match ${schema.pattern}`);
  }
  if (
    typeof schema.minimum === "number" &&
    typeof value === "number" &&
    value < schema.minimum
  ) {
    errs.push(`${here}: below minimum ${schema.minimum}`);
  }
  if (typeOf(value) === "object") {
    const obj = /** @type {Record<string, unknown>} */ (value);
    for (const key of schema.required ?? [])
      if (!(key in obj)) errs.push(`${at}/${key}: required`);
    for (const [key, sub] of Object.entries(schema.properties ?? {})) {
      if (key in obj) errs.push(...validate(sub, obj[key], `${at}/${key}`));
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(obj)) {
        if (!(key in (schema.properties ?? {})))
          errs.push(`${at}/${key}: not allowed`);
      }
    }
  }
  if (Array.isArray(value)) {
    if (typeof schema.minItems === "number" && value.length < schema.minItems) {
      errs.push(`${here}: fewer than ${schema.minItems} items`);
    }
    if (typeof schema.maxItems === "number" && value.length > schema.maxItems) {
      errs.push(`${here}: more than ${schema.maxItems} items`);
    }
    if (schema.items)
      value.forEach((v, i) =>
        errs.push(...validate(schema.items, v, `${at}/${i}`)),
      );
  }
  return errs;
}
