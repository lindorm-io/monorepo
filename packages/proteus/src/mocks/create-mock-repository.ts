import { Predicated } from "@lindorm/utils";
import type { IEntity, IProteusRepository } from "../interfaces/index.js";
import { filterMockRows } from "./filter-mock-rows.js";
import { paginateMockRows } from "./paginate-mock-rows.js";

type EntityFactory<E extends IEntity = IEntity> = (options?: any) => E;

const defaultFactory =
  <E extends IEntity = IEntity>(): EntityFactory<E> =>
  (options) =>
    (options ?? {}) as E;

/**
 * Build a mock repository.
 *
 * When `rows` is supplied the read queries (`find`, `findOne`, `find­AndCount`,
 * `count`, `exists`, `findPaginated`) are served from that in-memory array with
 * faithful predicate filtering + offset/page pagination — so a seeded mock
 * behaves like a real repository without per-test `mockResolvedValue` wiring.
 * Every method is still a spy, so any default remains overridable. Keyset
 * `paginate`, aggregates and write methods keep their non-seeded stubs.
 */
export const _createMockRepository = <E extends IEntity = IEntity>(
  mockFn: () => any,
  rows?: Array<E>,
  factory: EntityFactory<E> = defaultFactory(),
): IProteusRepository<E> => {
  const impl = (fn: any) => {
    const m = mockFn();
    m.mockImplementation(fn);
    return m;
  };
  const resolves = (value: any) => {
    const m = mockFn();
    m.mockResolvedValue(value);
    return m;
  };

  const seeded = rows !== undefined;

  // Apply offset/limit to a filtered row array, matching find/findAndCount.
  const take = (result: Array<E>, options: any): Array<E> => {
    const offset = options?.offset ?? 0;
    return options?.limit != null
      ? result.slice(offset, offset + options.limit)
      : result.slice(offset);
  };

  return {
    // Entity Handlers
    create: impl((opts: any) => factory(opts)),
    copy: impl((e: any) => factory(e)),
    validate: mockFn(),

    // Queries — served from `rows` when seeded, else echo the factory.
    count: seeded
      ? impl(async (criteria: any) => filterMockRows(rows, criteria).length)
      : resolves(1),
    exists: seeded
      ? impl(async (criteria: any) => filterMockRows(rows, criteria).length > 0)
      : resolves(true),
    find: seeded
      ? impl(async (criteria: any, options: any) =>
          take(filterMockRows(rows, criteria), options),
        )
      : impl(async (criteria: any) => [factory(criteria)]),
    findAndCount: seeded
      ? impl(async (criteria: any, options: any) => {
          const filtered = filterMockRows(rows, criteria);
          return [take(filtered, options), filtered.length];
        })
      : impl(async (criteria: any) => [[factory(criteria)], 1]),
    findOne: seeded
      ? impl(
          async (criteria: any) => Predicated.find(rows as any, criteria ?? {}) ?? null,
        )
      : impl(async (criteria: any) => factory(criteria)),
    findOneOrFail: impl(async (criteria: any) => factory(criteria)),
    findOneOrSave: impl(async (criteria: any) => factory(criteria)),

    // Upsert
    upsert: impl(async (e: any) => e),

    // Create/Update/Destroy
    insert: impl(async (e: any) => e),
    save: impl(async (e: any) => e),
    update: impl(async (e: any) => e),
    clone: impl(async (e: any) => e),
    destroy: mockFn(),

    // Increments and Decrements
    increment: mockFn(),
    decrement: mockFn(),

    // With Criteria
    delete: mockFn(),
    updateMany: mockFn(),

    // With Soft Deletes
    softDestroy: mockFn(),
    softDelete: mockFn(),
    restore: mockFn(),

    // With Versioning
    versions: impl(async (criteria: any) => [factory(criteria)]),

    // Aggregates
    sum: resolves(null),
    average: resolves(null),
    minimum: resolves(null),
    maximum: resolves(null),

    // With Expiry
    ttl: resolves(60),
    deleteExpired: mockFn(),

    // Pagination
    paginate: resolves({
      data: [],
      startCursor: null,
      endCursor: null,
      hasNextPage: false,
      hasPreviousPage: false,
    }),
    findPaginated: seeded
      ? impl(async (criteria: any, options: any) =>
          paginateMockRows(rows, criteria, options),
        )
      : resolves({
          data: [],
          total: 0,
          page: 1,
          pageSize: 10,
          totalPages: 0,
          hasMore: false,
        }),

    // Cursor / Stream
    cursor: mockFn(),
    stream: mockFn(),

    // Truncate
    clear: mockFn(),

    // Global
    queryBuilder: mockFn(),
    setup: mockFn(),
  } as unknown as IProteusRepository<E>;
};
