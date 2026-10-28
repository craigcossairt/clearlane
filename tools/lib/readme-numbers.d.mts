export const START: string;
export const END: string;
export const README_KEYS: { key: string; label: string }[];
export function renderBlock(numbers: { key: string; display: string; prov: string; as_of_mt: string }[]): string;
export function replaceBlock(text: string, block: string): string;
