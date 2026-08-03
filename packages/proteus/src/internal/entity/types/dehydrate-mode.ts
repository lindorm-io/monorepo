/**
 * Which write a dehydration is feeding, and therefore which columns it must
 * leave out (see `getSkipKeys`):
 *
 * - "insert": skip DB-minted increment/identity columns
 * - "update": skip those plus PKs, CreateDate and user-facing readonly fields
 */
export type DehydrateMode = "insert" | "update";
