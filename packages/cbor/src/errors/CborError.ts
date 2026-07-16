import { LindormError } from "@lindorm/errors";

export class CborError extends LindormError {
  static readonly namespace = "cbor";
}
