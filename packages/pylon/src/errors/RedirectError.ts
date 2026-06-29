import { LindormError, type LindormErrorOptions } from "@lindorm/errors";

type Options = LindormErrorOptions & {
  redirect: string;
  state?: string;
  uri?: string;
};

export class RedirectError extends LindormError {
  static readonly namespace = "pylon";

  readonly redirect: string;
  readonly state: string | undefined;
  readonly uri: string | undefined;

  constructor(message: string, options: Options) {
    super(message, options);

    this.redirect = options.redirect;
    this.state = options.state;
    this.uri = options.uri;
  }
}
