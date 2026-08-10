import type { AmphoraIdpSettings } from "../../types/index.js";
import type { ExternalEntry } from "../types/external-entry.js";
import { seedExternalConfig } from "./seed-external-config.js";

/**
 * The initial entry for the UPSTREAM identity provider — `seedExternalConfig`
 * plus the two things that distinguish the idp: its `scope`, and that it is
 * REQUIRED, always. {@link AmphoraIdpSettings} has no `required` to declare, so
 * this is the single place the idp's strictness is written, and nothing rewrites
 * it afterwards.
 *
 * Stamping both rather than special-casing the idp downstream is what keeps "is a
 * failure here fatal?" and "which scope is this?" ONE question each with ONE
 * answer, asked identically of every entry.
 *
 * The idp is `declared` HOWEVER it arrived — including through `idp.set()` at
 * runtime. It is a singleton the operator points the service at, not one of a
 * client-sized population, so the scheduled sweep is exactly where it belongs.
 */
export const seedIdpConfig = (input: AmphoraIdpSettings): ExternalEntry => ({
  ...seedExternalConfig(input, "declared"),
  scope: "idp",
  required: true,
});
