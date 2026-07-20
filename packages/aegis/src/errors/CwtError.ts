import { CoseError } from "./CoseError.js";

export class CwtError extends CoseError {
  static readonly namespace = "aegis";
}
