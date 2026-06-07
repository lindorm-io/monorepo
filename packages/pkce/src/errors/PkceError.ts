import { LindormError } from "@lindorm/errors";

export class PkceError extends LindormError {
  public static readonly namespace = "pkce";
}
