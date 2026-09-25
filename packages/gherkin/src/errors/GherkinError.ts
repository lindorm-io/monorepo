import type { Dict } from "@lindorm/types";

export type GherkinErrorOptions = ErrorOptions & {
  code: string;
  data?: Dict;
  details?: string;
  /**
   * The file the error concerns — vite's error formatter prints it as `File:`.
   * Pinned by src/e2e/meta-no-lowering.test.ts.
   */
  id?: string;
};

export class GherkinError extends Error {
  readonly code: string;
  readonly data: Dict;
  readonly details: string | null;
  readonly id: string | null;

  constructor(message: string, options: GherkinErrorOptions) {
    super(message, options);

    this.name = this.constructor.name;
    this.code = options.code;
    this.data = options.data ?? {};
    this.details = options.details ?? null;
    this.id = options.id ?? null;
  }
}
