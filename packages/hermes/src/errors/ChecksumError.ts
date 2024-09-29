import { DomainError } from "./DomainError";

export class ChecksumError extends DomainError {
  public constructor(message: string, error?: Error) {
    super(message, { permanent: true, error });
  }
}
