import { DomainError } from "./DomainError";

export class ViewDestroyedError extends DomainError {
  public constructor() {
    super("View is destroyed", { permanent: true });
  }
}
