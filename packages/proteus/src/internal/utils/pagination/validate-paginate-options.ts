import type { IEntity } from "../../../interfaces/index.js";
import type { PaginateOptions } from "../../../types/paginate-options.js";
import { ProteusError } from "../../../errors/index.js";
import type { EntityMetadata } from "../../entity/types/metadata.js";

/**
 * Validate paginate options for mutual exclusivity and required fields.
 *
 * Rules:
 * - Exactly one of `first` or `last` must be provided (page size + direction)
 * - `after` is only valid with `first` (forward pagination)
 * - `before` is only valid with `last` (backward pagination)
 * - `first` / `last` must be positive integers
 * - `orderBy` must have at least one entry
 * - All `orderBy` keys must correspond to fields defined in entity metadata
 */
export const validatePaginateOptions = <E extends IEntity>(
  options: PaginateOptions<E>,
  metadata?: EntityMetadata,
): void => {
  const hasFirst = options.first != null;
  const hasLast = options.last != null;

  if (!hasFirst && !hasLast) {
    throw new ProteusError(
      "paginate() requires either `first` or `last` to specify page size and direction",
    );
  }

  if (hasFirst && hasLast) {
    throw new ProteusError(
      "paginate() does not support both `first` and `last` simultaneously",
    );
  }

  if (hasFirst) {
    if (!Number.isInteger(options.first) || options.first! <= 0) {
      throw new ProteusError(
        `paginate() \`first\` must be a positive integer, got ${options.first}`,
      );
    }
    if (options.before != null) {
      throw new ProteusError(
        "paginate() `before` cursor is only valid with `last`, not `first`",
      );
    }
  }

  if (hasLast) {
    if (!Number.isInteger(options.last) || options.last! <= 0) {
      throw new ProteusError(
        `paginate() \`last\` must be a positive integer, got ${options.last}`,
      );
    }
    if (options.after != null) {
      throw new ProteusError(
        "paginate() `after` cursor is only valid with `first`, not `last`",
      );
    }
  }

  const orderEntries = Object.entries(options.orderBy).filter(([, v]) => v != null);
  if (orderEntries.length === 0) {
    throw new ProteusError("paginate() requires at least one entry in `orderBy`");
  }

  if (metadata) {
    const validKeys = new Set(metadata.fields.map((f) => f.key));
    for (const [column] of orderEntries) {
      if (!validKeys.has(column)) {
        throw new ProteusError(`Unknown field "${column}" in paginate orderBy`);
      }
    }
  }
};
