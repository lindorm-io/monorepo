import { isObjectLike } from "@lindorm/is";
import { PENDING_STEP_BRAND } from "../internal/metadata/symbols.js";
import type { PendingStepError } from "./PendingStepError.js";

/**
 * Brand check, never instanceof: with two installed copies of the package a
 * consumer's PendingStepError is a DIFFERENT class, and instanceof would
 * silently degrade its pending step to a generic step failure. Both copies
 * compute the same `Symbol.for` key (house pattern: KryptosKit.isKryptos).
 * Runner-internal — deliberately not on the public barrel; M1's surface is
 * locked.
 */
export const isPendingStepError = (input: unknown): input is PendingStepError =>
  isObjectLike(input) && (input as Record<symbol, unknown>)[PENDING_STEP_BRAND] === true;
