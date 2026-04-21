import { ProteusRepositoryError } from "./ProteusRepositoryError.js";

export class OptimisticLockError extends ProteusRepositoryError {
  public constructor(entityName: string, primaryKey: Record<string, unknown>) {
    super(`Optimistic lock failed for "${entityName}"`, {
      debug: { entityName, primaryKey },
    });
  }
}
