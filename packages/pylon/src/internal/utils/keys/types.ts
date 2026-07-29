import type { PylonEncKey, PylonSignKey, PylonVerifyKey } from "../../../types/index.js";

/**
 * The FLAT key selectors as DECLARED on a cookie/session Settings — the shape
 * `resolveSessionKeys` reads from `PylonCookieSettings` and `PylonSessionSettings`
 * alike (both carry `signature`/`encryption`).
 */
export type PylonKeySelectors = {
  signature?: PylonSignKey;
  encryption?: PylonEncKey;
};

/**
 * The RESOLVED cookie key roles — internal only. `signature` and `encryption`
 * are the declared selectors; `verification` is DERIVED from the resolved
 * signature's condition (see `resolveVerificationKey`), never declared.
 */
export type PylonResolvedKeys = {
  signature?: PylonSignKey;
  verification?: PylonVerifyKey;
  encryption?: PylonEncKey;
};
