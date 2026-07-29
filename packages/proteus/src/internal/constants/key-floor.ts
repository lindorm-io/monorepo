import type { AmphoraCondition } from "@lindorm/amphora";

/**
 * The DEFAULT — overridable, unlike the floor: the caller's condition wins.
 *
 * A field-encryption key is a KEK. It never leaves the service and never belongs
 * in a JWKS, so an unpublished key is the right default — and amphora's own
 * filter defaults to `publish: true`, so WITHOUT this a KEK is invisible. But
 * `publish` is consumer policy everywhere else in the toolkit, so it stays a
 * default rather than becoming a second floor.
 */
export const ENCRYPTION_DEFAULT: AmphoraCondition = { publish: false };
