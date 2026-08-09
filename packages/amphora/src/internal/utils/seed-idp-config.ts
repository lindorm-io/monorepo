import type { AmphoraIdpSettings } from "../../types/index.js";
import type { ExternalEntry } from "../types/external-entry.js";
import { seedExternalConfig } from "./seed-external-config.js";

/**
 * The initial entry for the UPSTREAM identity provider — `seedExternalConfig`
 * plus the one thing that distinguishes the idp: it is REQUIRED, always.
 * {@link AmphoraIdpSettings} has no `required` to declare, so this is the single
 * place the idp's strictness is written, and nothing rewrites it afterwards.
 *
 * Stamping `required: true` rather than special-casing the idp downstream is what
 * keeps "is a failure here fatal?" ONE question with ONE answer, asked identically
 * of every entry by the setup sweep.
 */
export const seedIdpConfig = (input: AmphoraIdpSettings): ExternalEntry => ({
  ...seedExternalConfig(input),
  required: true,
});
