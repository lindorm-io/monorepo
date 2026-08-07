import type { AmphoraExternalSettings } from "../../types/index.js";
import type { ExternalEntry } from "../types/external-entry.js";
import { validateExternalSource } from "./validate-external-source.js";

/**
 * The initial, UNRESOLVED entry for a registered issuer source — `input` verbatim
 * plus derived fields left empty. `resolveExternalConfig` fills `issuer` / `jwksUri`
 * / `openIdConfiguration`; `keyCount` / `lastRefresh` fill in when its keys land.
 * `lastAccess` stays `null` here (never-used) — `addExternalConfig` stamps it at
 * registration so a just-registered external issuer is not the immediate LRU victim.
 *
 * Every registration path (construction, `addIssuer`, `idp.set`) seeds through here,
 * so the SYNCHRONOUS item-1 validation runs at registration time — a non-URI issuer
 * (etc.) is rejected up front, NOT silently accepted on the lazy (`load: false`) path.
 */
export const seedExternalConfig = (input: AmphoraExternalSettings): ExternalEntry => {
  validateExternalSource(input);

  return {
    input,
    load: input.load ?? false,
    issuer: input.issuer ?? null,
    jwksUri: input.jwksUri ?? null,
    openIdConfiguration: null,
    keyCount: 0,
    lastRefresh: null,
    lastAccess: null,
  };
};
