import { z } from "zod";
import { PromptMode } from "../enums/PromptMode.js";

/**
 * CLOSED validator for the `prompt` values of OIDC Core §3.1.2.1 plus OIDC
 * Initiating User Registration 1.0 §4, built from the `PromptMode` runtime
 * object.
 *
 * `prompt` is a space-delimited list on the wire — split before parsing, one
 * value per parse.
 */
export const promptModeSchema = z.enum(PromptMode);
