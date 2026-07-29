import type { IrisEncryptionCondition } from "../../types/encryption.js";

/**
 * The DEFAULT vault query — overridable, unlike the floor: the caller's
 * condition wins on any key it names.
 *
 * A message KEK never leaves the service, so `publish: false` is the right
 * default — and amphora's own filter defaults to `publish: true`, so without it
 * an internal KEK is invisible to every query. But `publish` is consumer policy
 * everywhere else in the toolkit, so a caller who means it keeps the last word.
 */
export const ENCRYPTION_DEFAULT: IrisEncryptionCondition = { publish: false };
