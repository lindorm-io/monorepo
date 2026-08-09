import type { IAmphora } from "@lindorm/amphora";
import type { PylonAuthSettings } from "../../../types/index.js";
import { resolveIdpIssuer, resolveSelfIssuer } from "./driver/resolve-amphora-issuer.js";

/**
 * Hold the deployment's amphora against the issuer scope its driver PINNED —
 * AFTER `amphora.setup()`, which is what makes the answer final: every issuer is
 * fetched there and a required one that fails throws there, so a registered idp
 * is resolved by the time this runs. What is left to check is purely local
 * configuration, and it needs no network of its own.
 *
 * The scope a driver pins is the one thing it cannot degrade without: a pinned
 * issuer that resolves to nothing verifies every token against nothing. Without
 * this, a deployment that pinned a scope amphora does not hold boots to a
 * warning and discovers it as a 500 on the first request that reaches the
 * issuer — `/.well-known/oauth-protected-resource`, or any driver call.
 *
 * ⚠ It resolves and DISCARDS. The resolvers already throw by name for both
 * cases (`self_issuer_not_configured`, and amphora's own `idp_not_configured` /
 * `idp_issuer_unresolved`), and those are the errors an operator must see —
 * calling them for effect is the whole check, and a second vocabulary saying the
 * same thing at boot could only drift from the one said per request.
 *
 * ⚠ It never calls `driver.endpoints()`. Every endpoint but the issuer is
 * legitimately `null`, so which of them a deployment needs is the DRIVER's
 * knowledge — a question `validateAuthSettings` already asks properly, by
 * testing which driver methods exist.
 */
export const validateAuthIssuer = (
  settings: PylonAuthSettings,
  amphora: IAmphora,
): void => {
  switch (settings.driver.issuerScope) {
    case "self":
      resolveSelfIssuer({ amphora });
      return;

    case "idp":
      resolveIdpIssuer({ amphora });
      return;

    // The driver STATED that it pins neither own-side scope: it resolves a
    // literal issuer of its own, and there is nothing here to hold it against.
    case "none":
      return;
  }
};
