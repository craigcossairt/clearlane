// A checker for the JSON Schema keywords our contracts use. Any other keyword throws, so a schema that
// grows past this subset fails loudly instead of passing unchecked.
type Schema = Record<string, unknown>;

const ANNOTATIONS = new Set(["$schema", "$id", "title", "description"]);
const KEYWORDS = new Set([
  "type",
  "required",
  "properties",
  "additionalProperties",
  "const",
  "pattern",
  "minimum",
  "minItems",
  "maxItems",
  "items",
]);

const typeOf = (x: unknown) =>
  x === null ? "null" : Array.isArray(x) ? "array" : typeof x;

export function schemaErrors(s: Schema, x: unknown, at = "$"): string[] {
  const e: string[] = [];
  for (const k of Object.keys(s))
    if (!ANNOTATIONS.has(k) && !KEYWORDS.has(k))
      throw new Error(`unsupported schema keyword ${k} at ${at}`);
  if (s.type !== undefined) {
    const t = typeOf(x);
    // JSON has no NaN or Infinity, so a non-finite number never matches
    const ok =
      s.type === "integer"
        ? Number.isInteger(x)
        : s.type === t && (t !== "number" || Number.isFinite(x));
    if (!ok) return [`${at}: expected ${String(s.type)}, got ${t}`];
  }
  if ("const" in s && x !== s.const)
    e.push(`${at}: expected ${JSON.stringify(s.const)}`);
  if (
    typeof s.pattern === "string" &&
    typeof x === "string" &&
    !new RegExp(s.pattern, "u").test(x)
  )
    e.push(`${at}: ${x} does not match ${s.pattern}`);
  if (typeof s.minimum === "number" && typeof x === "number" && x < s.minimum)
    e.push(`${at}: ${x} < ${s.minimum}`);
  if (Array.isArray(x)) {
    if (typeof s.minItems === "number" && x.length < s.minItems)
      e.push(`${at}: fewer than ${s.minItems} items`);
    if (typeof s.maxItems === "number" && x.length > s.maxItems)
      e.push(`${at}: more than ${s.maxItems} items`);
    if (s.items)
      x.forEach((v, i) =>
        e.push(...schemaErrors(s.items as Schema, v, `${at}[${i}]`)),
      );
  }
  if (typeOf(x) === "object") {
    const o = x as Record<string, unknown>;
    const props = (s.properties ?? {}) as Record<string, Schema>;
    for (const r of (s.required ?? []) as string[])
      if (!(r in o)) e.push(`${at}: missing ${r}`);
    for (const [k, v] of Object.entries(o)) {
      if (props[k]) e.push(...schemaErrors(props[k]!, v, `${at}.${k}`));
      else if (s.additionalProperties === false)
        e.push(`${at}: unexpected ${k}`);
    }
  }
  return e;
}
