/**
 * Configure TRUNCATE behavior for `repository.clear()`.
 */
export type ClearOptions = {
  /** Cascade the truncation to dependent tables via foreign key constraints. */
  cascade?: boolean;
  /** Reset auto-increment / identity sequences to their initial values. */
  restartIdentity?: boolean;
};
