import type { FindPaginatedResult } from "../types/index.js";
import { filterMockRows } from "./filter-mock-rows.js";

/**
 * Offset/page pagination over an in-memory row array, mirroring the real
 * repository's `findPaginated` contract (defaults: page 1, pageSize 10). Rows
 * are paged in insertion order — ordering is the DB's job and is not emulated,
 * so seed rows in the order the assertion expects.
 */
export const paginateMockRows = <T>(
  rows: Array<T>,
  criteria?: unknown,
  options?: { page?: number; pageSize?: number },
): FindPaginatedResult<any> => {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 10;
  const filtered = filterMockRows(rows, criteria);
  const total = filtered.length;
  const start = (page - 1) * pageSize;

  return {
    data: filtered.slice(start, start + pageSize) as Array<any>,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    hasMore: page * pageSize < total,
  };
};
