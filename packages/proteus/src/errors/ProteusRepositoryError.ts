import { ProteusError } from "./ProteusError.js";

/**
 * Thrown when a repository operation fails.
 *
 * Covers validation failures, version conflicts, entity-not-found errors,
 * and constraint violations during CRUD operations.
 */
export class ProteusRepositoryError extends ProteusError {}
