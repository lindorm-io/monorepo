import { DomainError } from "./DomainError";

export class CacheNotCreatedError extends DomainError {
  public constructor(permanent = false) {
    super("Cache has not been created", { permanent });
  }
}
