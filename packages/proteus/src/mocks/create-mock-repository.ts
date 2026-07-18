import { Predicated } from "@lindorm/utils";
import { ProteusError } from "../errors/ProteusError.js";
import type { IEntity, IProteusRepository } from "../interfaces/index.js";
import { filterMockRows } from "./filter-mock-rows.js";
import { paginateMockRows } from "./paginate-mock-rows.js";

type EntityFactory<E extends IEntity = IEntity> = (options?: any) => E;

const defaultFactory =
  <E extends IEntity = IEntity>(): EntityFactory<E> =>
  (options) =>
    (options ?? {}) as E;

// Generated ids for seeded inserts without an id. Module-level so ids stay
// unique across every seeded repository built in a test run.
let idCounter = 0;
const nextId = (): string => `mock_id_${++idCounter}`;

// Mirror the real EntityManager: create()/copy() mint the client-side IDENTITY
// id (lindorm_id / uuid / string) app-side, so entity.id is populated before
// insert. The mock has no entity metadata, so it treats `id` as that field —
// matching the seeded write primitives, which already assume a string `id`.
// A caller-supplied id is preserved (create()/copy() never overwrite it).
const withCreateId = <E>(entity: E): E =>
  entity != null && (entity as any).id == null
    ? { ...(entity as any), id: nextId() }
    : entity;

// clone() drops the source id and mints a FRESH one, like the real clone().
const withCloneId = <E>(entity: E): E => ({ ...(entity as any), id: nextId() });

/**
 * Build a mock repository.
 *
 * When `rows` is supplied the read queries (`find`, `findOne`, `find­AndCount`,
 * `count`, `exists`, `findPaginated`) are served from that in-memory array with
 * faithful predicate filtering + offset/page pagination — so a seeded mock
 * behaves like a real repository without per-test `mockResolvedValue` wiring.
 * A seeded mock is also a stateful little store: write methods mutate the same
 * `rows` array the reads are served from, so `insert` → `findOne` round-trips.
 * Every method is still a spy, so any default remains overridable. Keyset
 * `paginate`, aggregates, versions, soft-deletes, expiry and cursor/stream keep
 * their non-seeded stubs.
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

  // Seeded write primitives — mutate the `rows` store in place. `rows` is
  // guaranteed non-null here (only referenced from `seeded ? …` branches).
  const store = rows as Array<any>;

  const forEachInput = (input: any, fn: (e: any) => void): void => {
    if (Array.isArray(input)) input.forEach(fn);
    else fn(input);
  };
  const mapInput = (input: any, fn: (e: any) => any): any =>
    Array.isArray(input) ? input.map(fn) : fn(input);

  const insertOne = (input: any): any => {
    const e = { ...input };
    if (e.id == null) e.id = nextId();
    store.push(e);
    return e;
  };
  const upsertOne = (input: any): any => {
    const e = { ...input };
    const i = e.id != null ? store.findIndex((r) => r.id === e.id) : -1;
    if (i >= 0) {
      store[i] = { ...store[i], ...e };
      return store[i];
    }
    if (e.id == null) e.id = nextId();
    store.push(e);
    return e;
  };
  const updateOne = (entity: any): any => {
    const i = store.findIndex((r) => r.id === entity.id);
    if (i >= 0) {
      store[i] = { ...store[i], ...entity };
      return store[i];
    }
    return entity;
  };
  const destroyOne = (entity: any): void => {
    const i = store.findIndex((r) => r.id === entity.id);
    if (i >= 0) store.splice(i, 1);
  };

  return {
    // Entity Handlers
    create: impl((opts: any) => withCreateId(factory(opts))),
    copy: impl((e: any) => withCreateId(factory(e))),
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
    findOneOrFail: seeded
      ? impl(async (criteria: any) => {
          const found = Predicated.find(store, criteria ?? {});
          if (!found) throw new ProteusError("Entity not found");
          return found;
        })
      : impl(async (criteria: any) => factory(criteria)),
    findOneOrSave: seeded
      ? impl(async (criteria: any, entity: any) => {
          const found = Predicated.find(store, criteria ?? {});
          if (found) return found;
          return insertOne(entity);
        })
      : impl(async (criteria: any) => factory(criteria)),

    // Upsert
    upsert: seeded
      ? impl(async (input: any) => mapInput(input, upsertOne))
      : impl(async (e: any) => e),

    // Create/Update/Destroy
    insert: seeded
      ? impl(async (input: any) => mapInput(input, insertOne))
      : impl(async (e: any) => e),
    save: seeded
      ? impl(async (input: any) => mapInput(input, upsertOne))
      : impl(async (e: any) => e),
    update: seeded
      ? impl(async (input: any) => mapInput(input, updateOne))
      : impl(async (e: any) => e),
    clone: impl(async (e: any) => withCloneId(e)),
    destroy: seeded
      ? impl(async (input: any) => {
          forEachInput(input, destroyOne);
        })
      : mockFn(),

    // Increments and Decrements
    increment: seeded
      ? impl(async (criteria: any, property: any, value: number) => {
          for (const m of filterMockRows(store, criteria))
            m[property] = (m[property] ?? 0) + value;
        })
      : mockFn(),
    decrement: seeded
      ? impl(async (criteria: any, property: any, value: number) => {
          for (const m of filterMockRows(store, criteria))
            m[property] = (m[property] ?? 0) - value;
        })
      : mockFn(),

    // With Criteria
    delete: seeded
      ? impl(async (criteria: any) => {
          for (const m of filterMockRows(store, criteria)) {
            const i = store.indexOf(m);
            if (i >= 0) store.splice(i, 1);
          }
        })
      : mockFn(),
    updateMany: seeded
      ? impl(async (criteria: any, update: any) => {
          for (const m of filterMockRows(store, criteria)) Object.assign(m, update);
        })
      : mockFn(),

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
    clear: seeded
      ? impl(async () => {
          store.length = 0;
        })
      : mockFn(),

    // Global
    queryBuilder: mockFn(),
    setup: mockFn(),
  } as unknown as IProteusRepository<E>;
};
