const VERBATIM_KEY_CHARACTER = /[^\p{L}\d_]/u;

// pinned: is-verbatim-key.test.ts
export const isVerbatimKey = (key: string): boolean => VERBATIM_KEY_CHARACTER.test(key);
