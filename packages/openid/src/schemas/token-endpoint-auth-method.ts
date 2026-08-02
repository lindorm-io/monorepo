import { z } from "zod";
import { TokenEndpointAuthMethod } from "../enums/TokenEndpointAuthMethod.js";

/**
 * CLOSED validator for the token endpoint client authentication methods this
 * vocabulary knows — OIDC Core §9, RFC 7591 §2, RFC 8705 §2 — built from the
 * `TokenEndpointAuthMethod` runtime object.
 *
 * The IANA registry is extensible; a deployment accepting an unlisted method
 * validates it with its own union.
 */
export const tokenEndpointAuthMethodSchema = z.enum(TokenEndpointAuthMethod);
