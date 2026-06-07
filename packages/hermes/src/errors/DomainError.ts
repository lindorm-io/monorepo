import { LindormError, type LindormErrorOptions } from "@lindorm/errors";

export type DomainErrorOptions = LindormErrorOptions & {
  permanent?: boolean;
};

export class DomainError extends LindormError {
  public static readonly namespace = "hermes";

  public readonly permanent: boolean;

  public constructor(message: string, options: DomainErrorOptions = {}) {
    const { permanent = false, ...rest } = options;
    super(message, rest);
    this.permanent = permanent;
  }
}
