import type { IKryptos } from "../../interfaces/index.js";
import { KRYPTOS_BRAND } from "../constants/brand.js";

// Recognises a Kryptos instance by its global-registry brand instead of
// `instanceof`, so a key created by one copy of @lindorm/kryptos is still
// recognised by guards running in a duplicate copy (dual-install resilience).
export const isKryptos = (value: unknown): value is IKryptos =>
  value != null &&
  typeof value === "object" &&
  (value as { constructor?: Record<symbol, unknown> }).constructor?.[KRYPTOS_BRAND] ===
    true;
