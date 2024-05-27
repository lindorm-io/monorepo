import { LindormError, LindormErrorOptions } from "@lindorm/errors";

type Options = LindormErrorOptions & {
  redirect: string;
  state?: string;
  uri?: string;
};

export class RedirectError extends LindormError {
  public readonly redirect: string;
  public readonly state: string | undefined;
  public readonly uri: string | undefined;

  public constructor(message: string, options: Options) {
    super(message, options);

    this.redirect = options.redirect;
    this.state = options.state;
    this.uri = options.uri;
  }
}
