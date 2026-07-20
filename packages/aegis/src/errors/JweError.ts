import { JoseError } from "./JoseError.js";

export class JweError extends JoseError {
  static readonly namespace = "aegis";
}
