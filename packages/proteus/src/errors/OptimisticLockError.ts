import { ProteusRepositoryError } from "./ProteusRepositoryError";

export class OptimisticLockError extends ProteusRepositoryError {
  public constructor(entityName: string, primaryKey: Record<string, unknown>) {
    super(`Optimistic lock failed for "${entityName}"`, {
      debug: { entityName, primaryKey },
    });
  }
}
