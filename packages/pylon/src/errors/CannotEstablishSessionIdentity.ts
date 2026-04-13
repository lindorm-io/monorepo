import { ServerError } from "@lindorm/errors";

export class CannotEstablishSessionIdentity extends ServerError {
  public constructor() {
    super("Cannot establish session identity: no source yielded a subject");
  }
}
