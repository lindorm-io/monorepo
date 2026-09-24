import type { AppAuthConfig } from "../../../types/index.js";

/**
 * The ONE origin for the `critical` member of every `aegis.verify` pylon
 * performs: the deployment's declaration off `ctx.state.app.config.auth`.
 *
 * `null` — no auth block — declares nothing, so aegis refuses every critical
 * parameter. Fail closed. A fresh copy per call because aegis's
 * `VerifyOptions.critical` is a mutable `Array<string>` and the config's array
 * is frozen.
 */
export const deploymentCritical = (
  auth: AppAuthConfig | null,
): Array<string> | undefined => (auth ? [...auth.critical] : undefined);
