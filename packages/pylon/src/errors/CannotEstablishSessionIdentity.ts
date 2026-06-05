import { type LindormErrorOptions, ServerError } from "@lindorm/errors";

export class CannotEstablishSessionIdentity extends ServerError {
  public static readonly errorNamespace = "pylon";

  public constructor(options: LindormErrorOptions = {}) {
    super("Cannot establish session identity: no source yielded a subject", options);
  }
}
