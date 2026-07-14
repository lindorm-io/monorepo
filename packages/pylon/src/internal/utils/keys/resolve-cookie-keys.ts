import { removeUndefined } from "@lindorm/utils";
import type { PylonKeyRoles, PylonKeys } from "../../../types/index.js";
import { resolveVerificationKey } from "./resolve-verification-key.js";

/**
 * The keys an ORDINARY cookie uses, unless the cookie names its own.
 *
 * `signature` and `encryption` are the deployment's, verbatim. `verification`
 * defaults to the cookie signing policy — see `resolveVerificationKey`.
 */
export const resolveCookieKeys = (keys?: PylonKeys): PylonKeyRoles =>
  removeUndefined<PylonKeyRoles>({
    signature: keys?.cookie?.signature,
    verification: resolveVerificationKey(keys?.cookie),
    encryption: keys?.cookie?.encryption,
  });
