import { z } from "zod";
import { GrantType } from "../enums/GrantType.js";

/**
 * CLOSED validator for the grant types this vocabulary knows, built from the
 * `GrantType` runtime object.
 *
 * RFC 6749 §8.3 allows extension and vendor grant types — a deployment that
 * accepts one validates it with its own union, not by loosening this schema.
 */
export const grantTypeSchema = z.enum(GrantType);
