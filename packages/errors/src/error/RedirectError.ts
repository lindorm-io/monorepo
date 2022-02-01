import { LindormError, LindormErrorOptions } from "./LindormError";

interface Options extends LindormErrorOptions {
  redirect: string;
  state?: string;
  uri?: string;
}

export class RedirectError extends LindormError {
  public readonly redirect: string;
  public readonly state: string | null;
  public readonly uri: string | null;

  public constructor(message: string, options: Options) {
    super(message, options);

    this.redirect = options.redirect;
    this.state = options.state || null;
    this.uri = options.uri || null;
  }
}
