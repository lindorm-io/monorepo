import { relative } from "node:path";
import { normalizePath } from "vite";

/**
 * Root-relative, forward-slash uri — it appears in every failure-contract
 * message and is baked into the emitted module, so it must be deterministic
 * per input: same root + id gives byte-identical output regardless of
 * platform separators (normalizePath is vite's own posix normalization).
 */
export const toRootUri = (root: string, file: string): string =>
  normalizePath(relative(root, file));
