import type { SignKitSettings } from "../kit.js";

// The wire kit holds only what a standalone JWS/JWT verifier needs: the key, a
// clock tolerance for the temporal range check, and the cert-binding mode. DPoP
// skew + issuer are DOMAIN concerns, handled by the Aegis verify path.
export type JwtKitSettings = SignKitSettings & {
  clockTolerance?: number;
};
