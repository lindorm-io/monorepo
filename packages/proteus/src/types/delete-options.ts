/**
 * Configure delete query behavior.
 */
export type DeleteOptions = {
  /** Maximum number of rows to delete. Omit to delete all matching rows. */
  limit?: number;
};
