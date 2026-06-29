import { LindormError, type LindormErrorOptions } from "@lindorm/errors";

export type DomainErrorOptions = LindormErrorOptions & {
  permanent?: boolean;
};

export class DomainError extends LindormError {
  static readonly namespace = "hermes";

  readonly permanent: boolean;

  constructor(message: string, options: DomainErrorOptions = {}) {
    const { permanent = false, ...rest } = options;
    super(message, rest);
    this.permanent = permanent;
  }
}
