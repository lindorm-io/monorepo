import type { IEntity, IProteusRepository } from "../interfaces";

type EntityFactory<E extends IEntity = IEntity> = (options?: any) => E;

const defaultFactory =
  <E extends IEntity = IEntity>(): EntityFactory<E> =>
  (options) =>
    (options ?? {}) as E;

export const _createMockRepository = <E extends IEntity = IEntity>(
  mockFn: () => any,
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

  return {
    // Entity Handlers
    create: impl((opts: any) => factory(opts)),
    copy: impl((e: any) => factory(e)),
    validate: mockFn(),

    // Queries
    count: resolves(1),
    exists: resolves(true),
    find: impl(async (criteria: any) => [factory(criteria)]),
    findAndCount: impl(async (criteria: any) => [[factory(criteria)], 1]),
    findOne: impl(async (criteria: any) => factory(criteria)),
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
    findPaginated: resolves({
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
