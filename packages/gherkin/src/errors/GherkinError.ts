import type { Dict } from "@lindorm/types";

export type GherkinErrorOptions = ErrorOptions & {
  code: string;
  data?: Dict;
  details?: string;
  /** The file the error concerns. */
  file?: string;
};

export class GherkinError extends Error {
  readonly code: string;
  readonly data: Dict;
  readonly details: string | null;
  readonly file: string | null;
  /**
   * The same value as `file`, under the name vitest prints as `File:` for a
   * transform-hook throw. Pinned by
   * src/internal/plugin/assert-step-module-lowered.test.ts and
   * src/e2e/meta-no-lowering.test.ts.
   */
  readonly id: string | null;

  constructor(message: string, options: GherkinErrorOptions) {
    super(message, options);

    this.name = this.constructor.name;
    this.code = options.code;
    this.data = options.data ?? {};
    this.details = options.details ?? null;
    this.file = options.file ?? null;
    this.id = this.file;
  }
}
