import { AegisError } from "./AegisError.js";

export class AegisDomainError extends AegisError {
  static readonly namespace = "aegis";
}
