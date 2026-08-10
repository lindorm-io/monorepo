import type { AmphoraExternalSettings } from "../../types/index.js";
import type { ExternalEntry } from "../types/external-entry.js";
import { validateExternalSource } from "./validate-external-source.js";

/**
 * The initial, UNRESOLVED entry for a registered issuer source — `input` verbatim
 * plus derived fields left empty. `resolveExternalConfig` fills `issuer` / `jwksUri`
 * / `openIdConfiguration`; `keyCount` / `lastRefresh` fill in when its keys land,
 * and `failureCount` / `retryAfter` are the retry bookkeeping a failure writes.
 * `lastAccess` stays `null` here (never-used) — `addExternalEntry` stamps it at
 * registration so a just-registered external issuer is not the immediate LRU victim.
 *
 * `origin` is a PARAMETER rather than a derived value, on the same terms as `scope`:
 * the caller is the only party that knows whether this came from an operator's
 * standing declaration or from a request, and nothing about `input` says which.
 *
 * Every registration path seeds through here — construction, `addIssuer`, and
 * `idp.set` via {@link seedIdpConfig} — so the SYNCHRONOUS item-1 validation runs at
 * registration time: a non-URI issuer (etc.) is rejected up front rather than as a
 * `warn` from a later sweep, which is where a non-`required` source's failures go.
 */
export const seedExternalConfig = (
  input: AmphoraExternalSettings,
  origin: "declared" | "registered",
): ExternalEntry => {
  validateExternalSource(input);

  return {
    input,
    scope: "external",
    origin,
    required: input.required ?? false,
    issuer: input.issuer ?? null,
    jwksUri: input.jwksUri ?? null,
    openIdConfiguration: null,
    keyCount: 0,
    lastRefresh: null,
    lastAccess: null,
    failureCount: 0,
    retryAfter: null,
  };
};
