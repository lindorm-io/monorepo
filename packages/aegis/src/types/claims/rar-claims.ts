import type { AuthorizationDetail } from "@lindorm/types";

// RFC 9396 — Rich Authorization Requests. Domain form. The array travels
// verbatim on the wire; only the outer claim name is translated
// (authorizationDetails <-> authorization_details).
// https://www.rfc-editor.org/rfc/rfc9396
export type RarClaims = {
  authorizationDetails?: Array<AuthorizationDetail>;
};
