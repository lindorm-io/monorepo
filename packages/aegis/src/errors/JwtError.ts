import { JoseError } from "./JoseError.js";

export class JwtError extends JoseError {
  static readonly namespace = "aegis";
}
