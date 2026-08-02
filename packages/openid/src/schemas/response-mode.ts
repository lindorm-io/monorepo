import { z } from "zod";
import { ResponseMode } from "../enums/ResponseMode.js";

/**
 * CLOSED validator for the `response_mode` values this vocabulary knows, built
 * from the `ResponseMode` runtime object.
 *
 * The IANA response mode registry is extensible — a deployment accepting an
 * unlisted mode validates it with its own union.
 */
export const responseModeSchema = z.enum(ResponseMode);
