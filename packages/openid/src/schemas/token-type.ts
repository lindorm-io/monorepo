import { z } from "zod";
import { TokenType } from "../enums/TokenType.js";

/**
 * CLOSED validator for the RFC 6749 §7.1 access token types, built from the
 * `TokenType` runtime object. Case SENSITIVE — it validates the canonical
 * registered spelling; a reader that must tolerate the case-insensitive
 * spellings RFC 6749 §5.1 permits normalises the value first.
 */
export const tokenTypeSchema = z.enum(TokenType);
