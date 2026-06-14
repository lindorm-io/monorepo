import type { SecurityEvents } from "../../internal/claims/events.js";
import type { SubjectIdentifier } from "../../internal/claims/sub-id.js";

// Security Event Token claims, domain form (RFC 8417 / RFC 9493). The wire
// counterpart `SetClaimsWire` lives in `./jwt/set-claims-wire` and is consumed
// only by the wire<->domain mapping layer.
export type SetClaims = {
  events?: SecurityEvents;
  subjectId?: SubjectIdentifier;
  transactionId?: string;
};
