import { type LindormErrorOptions, ServerError } from "@lindorm/errors";

export class CannotEstablishSessionIdentity extends ServerError {
  static readonly namespace = "pylon";

  constructor(options: LindormErrorOptions = {}) {
    super("Cannot establish session identity: no source yielded a subject", options);
  }
}
