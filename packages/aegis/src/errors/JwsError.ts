import { JoseError } from "./JoseError.js";

export class JwsError extends JoseError {
  static readonly namespace = "aegis";
}
