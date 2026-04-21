import { DomainError } from "./DomainError.js";

export class ViewDestroyedError extends DomainError {
  public constructor() {
    super("View is destroyed", { permanent: true });
  }
}
