import { LindormError } from "@lindorm/errors";

/**
 * Base error class for all Proteus ORM errors.
 *
 * Extends `LindormError` for consistent error handling across the Lindorm ecosystem.
 */
export class ProteusError extends LindormError {}
