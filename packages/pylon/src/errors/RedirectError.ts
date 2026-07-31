import { LindormError, type LindormErrorOptions } from "@lindorm/errors";

type Options = LindormErrorOptions & {
  redirect: string;
  state?: string;
  uri?: string;
  /** The authorization-server issuer (domain name; emitted as the RFC 9207 `iss` wire param). */
  issuer?: string;
};

export class RedirectError extends LindormError {
  static readonly namespace = "pylon";

  readonly redirect: string;
  readonly state: string | undefined;
  readonly uri: string | undefined;
  readonly issuer: string | undefined;

  constructor(message: string, options: Options) {
    super(message, options);

    this.redirect = options.redirect;
    this.state = options.state;
    this.uri = options.uri;
    this.issuer = options.issuer;
  }
}
