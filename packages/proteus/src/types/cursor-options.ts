import type { Predicate } from "@lindorm/types";
import type { IEntity } from "../interfaces/Entity.js";

/**
 * Configure a server-side cursor for streaming large result sets.
 */
export type CursorOptions<E extends IEntity> = {
  /** Filter predicate for entities yielded by the cursor. */
  where?: Predicate<E>;
  /** Sort order for the cursor results. */
  orderBy?: Partial<Record<keyof E, "ASC" | "DESC">>;
  /** Number of rows fetched per network round-trip. */
  batchSize?: number;
  /** Include soft-deleted entities in the cursor results. */
  withDeleted?: boolean;
  /** Query the entity table as of this point in time (temporal/versioned tables). `null` disables. */
  versionTimestamp?: Date | null;
  /** Return only these fields from each entity. */
  select?: Array<keyof E>;
};
