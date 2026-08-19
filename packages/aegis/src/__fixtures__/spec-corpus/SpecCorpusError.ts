import { LindormError } from "@lindorm/errors";

/**
 * Every failure in the corpus harness. The `code` becomes the error type urn
 * (`urn:lindorm:aegis:error:<code>`), so a fail-closed guarantee is asserted by
 * code rather than by message text.
 */
export class SpecCorpusError extends LindormError {
  static readonly namespace = "aegis";
}
