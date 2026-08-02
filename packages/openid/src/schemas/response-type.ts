import { z } from "zod";
import { ResponseType } from "../enums/ResponseType.js";

/**
 * CLOSED validator for the `response_type` values this vocabulary knows, built
 * from the `ResponseType` runtime object.
 *
 * RFC 6749 §8.4 allows extension response types — a deployment accepting one
 * validates it with its own union.
 */
export const responseTypeSchema = z.enum(ResponseType);
