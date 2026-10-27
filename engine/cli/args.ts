// Tiny argv reader for the engine CLIs.
export function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export const hasFlag = (name: string) => process.argv.includes(name);
