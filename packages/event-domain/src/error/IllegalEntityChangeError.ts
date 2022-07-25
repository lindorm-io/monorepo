import { DomainError } from "./DomainError";

export class IllegalEntityChangeError extends DomainError {
  public constructor() {
    super("Unable to set value without using entity methods", { permanent: true });
  }
}
