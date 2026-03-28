import type { IEntity, IProteusRepository } from "../interfaces";

type EntityFactory<E extends IEntity = IEntity> = (options?: any) => E;

const defaultFactory =
  <E extends IEntity = IEntity>(): EntityFactory<E> =>
  (options) =>
    (options ?? {}) as E;

export const createMockRepository = <E extends IEntity = IEntity>(
  factory: EntityFactory<E> = defaultFactory(),
): IProteusRepository<E> =>
  ({
    // Entity Handlers

    create: jest.fn().mockImplementation((opts) => factory(opts)),
    copy: jest.fn().mockImplementation((e) => factory(e)),
    validate: jest.fn(),

    // Queries

    count: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(true),
    find: jest.fn().mockImplementation(async (criteria) => [factory(criteria)]),
    findAndCount: jest
      .fn()
      .mockImplementation(async (criteria) => [[factory(criteria)], 1]),
    findOne: jest.fn().mockImplementation(async (criteria) => factory(criteria)),
    findOneOrFail: jest.fn().mockImplementation(async (criteria) => factory(criteria)),
    findOneOrSave: jest.fn().mockImplementation(async (criteria) => factory(criteria)),

    // Upsert

    upsert: jest.fn().mockImplementation(async (e) => e),

    // Create/Update/Destroy

    insert: jest.fn().mockImplementation(async (e) => e),
    save: jest.fn().mockImplementation(async (e) => e),
    update: jest.fn().mockImplementation(async (e) => e),
    clone: jest.fn().mockImplementation(async (e) => e),
    destroy: jest.fn(),

    // Increments and Decrements

    increment: jest.fn(),
    decrement: jest.fn(),

    // With Criteria

    delete: jest.fn(),
    updateMany: jest.fn(),

    // With Soft Deletes

    softDestroy: jest.fn(),
    softDelete: jest.fn(),
    restore: jest.fn(),

    // With Versioning

    versions: jest.fn().mockImplementation(async (criteria) => [factory(criteria)]),

    // Aggregates

    sum: jest.fn().mockResolvedValue(null),
    average: jest.fn().mockResolvedValue(null),
    minimum: jest.fn().mockResolvedValue(null),
    maximum: jest.fn().mockResolvedValue(null),

    // With Expiry

    ttl: jest.fn().mockResolvedValue(60),
    deleteExpired: jest.fn(),

    // Pagination

    paginate: jest.fn().mockResolvedValue({
      data: [],
      startCursor: null,
      endCursor: null,
      hasNextPage: false,
      hasPreviousPage: false,
    }),
    findPaginated: jest.fn().mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0,
      hasMore: false,
    }),

    // Cursor / Stream

    cursor: jest.fn(),
    stream: jest.fn(),

    // Truncate

    clear: jest.fn(),

    // Global

    queryBuilder: jest.fn(),
    setup: jest.fn(),
  }) as unknown as IProteusRepository<E>;
