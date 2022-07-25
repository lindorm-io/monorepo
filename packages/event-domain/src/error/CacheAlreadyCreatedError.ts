import { DomainError } from "./DomainError";

export class CacheAlreadyCreatedError extends DomainError {
  public constructor(permanent = false) {
    super("Cache has already been created", { permanent });
  }
}
