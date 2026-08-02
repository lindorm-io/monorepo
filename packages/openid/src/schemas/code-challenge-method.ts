import { z } from "zod";
import { CodeChallengeMethod } from "../enums/CodeChallengeMethod.js";

/**
 * CLOSED validator for the RFC 7636 §4.2 (PKCE) `code_challenge_method`
 * values, built from the `CodeChallengeMethod` runtime object.
 */
export const codeChallengeMethodSchema = z.enum(CodeChallengeMethod);
