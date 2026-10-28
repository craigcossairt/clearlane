export declare const EXCLUDED_FIELDS: Record<string, string>;
export declare const FETCH_TIME_FIELDS: Record<string, string>;
export declare function sha256(buf: Uint8Array | string): string;
export declare function parseManifest(text: string): { sha: string; path: string }[];
export declare function renderManifest(files: Record<string, Uint8Array>): string;
export declare function diffJson(a: unknown, b: unknown, path?: string, ignore?: Record<string, string>): string[];
export declare function renderNumbersDoc(
  numbers: { key: string; display: string; prov: string; source: string; as_of_mt: string; [k: string]: unknown }[],
): string;
