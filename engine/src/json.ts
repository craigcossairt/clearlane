// Deterministic JSON for files in public/derived: two-space indent, LF, trailing newline.
// Key order is the object's insertion order, so builders fix it.
export function stableJson(x: unknown): string {
  return `${JSON.stringify(x, null, 2)}\n`;
}
