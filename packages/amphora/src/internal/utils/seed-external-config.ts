import type {
  AmphoraExternalConfig,
  AmphoraExternalSettings,
} from "../../types/index.js";
import { validateExternalSource } from "./validate-external-source.js";

/**
 * The initial, UNRESOLVED config for a registered issuer source — `input` verbatim
 * plus derived fields left empty. `resolveExternalConfig` fills `issuer` / `jwksUri`
 * / `openIdConfiguration`; `keyCount` / `lastRefresh` fill in when its keys land.
 *
 * Every registration path (construction, `addIssuer`, `idp.set`) seeds through here,
 * so the SYNCHRONOUS item-1 validation runs at registration time — a non-URI issuer
 * (etc.) is rejected up front, NOT silently accepted on the lazy (`load: false`) path.
 */
export const seedExternalConfig = (
  input: AmphoraExternalSettings,
): AmphoraExternalConfig => {
  validateExternalSource(input);

  return {
    input,
    load: input.load ?? false,
    issuer: input.issuer ?? null,
    jwksUri: input.jwksUri ?? null,
    openIdConfiguration: null,
    keyCount: 0,
    lastRefresh: null,
  };
};
