import { FILTERED } from "@lindorm/utils";
import type { PylonLoginCookie } from "../../../types/index.js";

/**
 * Redacts the login cookie for logging.
 *
 * `codeVerifier` is the PKCE secret — the one value in the cookie that must never reach a
 * log. `state`, `nonce` and the rest are public round-trip values, and they are precisely
 * what a state / nonce mismatch has to be debugged against, so they stay.
 */
export const redactLoginCookie = (cookie: PylonLoginCookie): PylonLoginCookie => ({
  ...cookie,
  codeVerifier: FILTERED,
});
