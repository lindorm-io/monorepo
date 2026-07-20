import type { AegisSensitive } from "./aegis-sensitive.js";

// Legacy alias for {@link AegisSensitive}, retained for the READ result field
// (`ParsedJwtPayload.sensitiveIdentity`) until the result-field rename lands
// with the new `VerifiedToken` type (Phase 16/19). Identical shape — the flat
// sensitive-claim wire model is documented on `AegisSensitive`.
export type AegisSensitiveIdentity = AegisSensitive;
