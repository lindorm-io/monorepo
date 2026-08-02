import { z } from "zod";
import { DisplayMode } from "../enums/DisplayMode.js";

/**
 * CLOSED validator for the OIDC Core §3.1.2.1 `display` values, built from the
 * `DisplayMode` runtime object.
 */
export const displayModeSchema = z.enum(DisplayMode);
