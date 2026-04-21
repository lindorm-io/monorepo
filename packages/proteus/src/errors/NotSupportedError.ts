import { ProteusError } from "./ProteusError.js";

/**
 * Thrown when an operation is not supported by the current driver or configuration.
 *
 * For example, using a driver that is not yet implemented, or calling a SQL-only
 * feature on a non-SQL driver.
 */
export class NotSupportedError extends ProteusError {}
