import type { WireTokenHeaderOptions } from "../../types/index.js";

declare const builtJoseHeader: unique symbol;

/**
 * ⛔ Only the final cast in `buildJoseHeader` mints one; another cast, or a spread
 * copy of a built header, carries the brand past the refusals.
 */
export type BuiltJoseHeader = WireTokenHeaderOptions & {
  readonly [builtJoseHeader]: true;
};
