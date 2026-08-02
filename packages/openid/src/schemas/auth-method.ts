import { z } from "zod";
import { AuthMethod } from "../enums/AuthMethod.js";

/**
 * CLOSED validator for the `amr` values of RFC 8176, built from the
 * `AuthMethod` runtime object so the two can never drift.
 *
 * A deployment using a custom AMR validates it with its own union — this
 * package only vouches for the registry.
 */
export const authMethodSchema = z.enum(AuthMethod);
