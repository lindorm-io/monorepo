import { ProteusError } from "./ProteusError";

/**
 * Thrown when a repository operation fails.
 *
 * Covers validation failures, version conflicts, entity-not-found errors,
 * and constraint violations during CRUD operations.
 */
export class ProteusRepositoryError extends ProteusError {}
