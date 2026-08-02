import { z } from "zod";
import { ClaimType } from "../enums/ClaimType.js";

/**
 * CLOSED validator for the OIDC Core §5.6 claim types, built from the
 * `ClaimType` runtime object.
 */
export const claimTypeSchema = z.enum(ClaimType);
