/**
 * Configure TRUNCATE behavior for `repository.truncate()`.
 */
export type TruncateOptions = {
  /** Cascade the truncation to dependent tables via foreign key constraints. */
  cascade?: boolean;
  /** Reset auto-increment / identity sequences to their initial values. */
  restartIdentity?: boolean;
};
