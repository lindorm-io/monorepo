import type { AuthorizationDetail } from "@lindorm/types";

// Wire form of RarClaims — RFC 9396. `authorization_details` is the
// registered JWT/wire claim name. Contents are carried verbatim.
// https://www.rfc-editor.org/rfc/rfc9396
export type RarClaimsWire = {
  authorization_details?: Array<AuthorizationDetail>;
};
