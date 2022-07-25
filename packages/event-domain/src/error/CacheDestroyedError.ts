import { DomainError } from "./DomainError";

export class CacheDestroyedError extends DomainError {
  public constructor() {
    super("Cache is destroyed", { permanent: true });
  }
}
