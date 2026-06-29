import { LindormError } from "@lindorm/errors";

export class PkceError extends LindormError {
  static readonly namespace = "pkce";
}
