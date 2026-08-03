import { randomUUID } from "crypto";
import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import { ProteusSource } from "../classes/ProteusSource.js";
import type {
  IEntity,
  IProteusRepository,
  IProteusSession,
  IProteusSource,
} from "../interfaces/index.js";
import type { CreateMockProteusSettings } from "./create-mock-proteus-settings.js";
import { createMockProteusVault } from "./create-mock-proteus-vault.js";

type MockFn = () => any;
type AnyRepo = IProteusRepository<any>;

/**
 * Every method on `IProteusRepository`. Each is spy-wrapped so its default
 * implementation delegates DIRECTLY to the real memory repository — sync methods
 * (`create`/`copy`/`validate`/`queryBuilder`) stay sync, async ones return their
 * promise, `stream` returns its async iterable. Every one remains a spy,
 * overridable via `mockResolvedValueOnce` etc.
 */
const REPO_METHODS = [
  "create",
  "copy",
  "validate",
  "count",
  "exists",
  "find",
  "findAndCount",
  "findOne",
  "findOneOrFail",
  "findOneOrSave",
  "upsert",
  "insert",
  "save",
  "update",
  "clone",
  "destroy",
  "increment",
  "decrement",
  "delete",
  "updateMany",
  "softDestroy",
  "softDelete",
  "restore",
  "versions",
  "sum",
  "average",
  "minimum",
  "maximum",
  "ttl",
  "deleteExpired",
  "paginate",
  "findPaginated",
  "cursor",
  "stream",
  "clear",
  "queryBuilder",
  "setup",
] as const;

/**
 * A memory-backed mock backend. Builds ONE real `ProteusSource({ driver:
 * "memory" })` over the PUBLIC API, `connect()`s and `setup()`s it (so entities
 * are registered and tables created), then hands out spy-wrapped
 * source/session/repository facades whose defaults delegate DIRECTLY to the real
 * in-memory driver.
 *
 * There is no lazy connect and no seed layer: the source is fully live before any
 * facade is returned, and tests seed the obvious way —
 * `await source.session().repository(E).insert([...])`. Every facade method stays
 * a spy (overridable via `mockResolvedValueOnce` etc.); the default just runs the
 * faithful memory path.
 */
export const createMemoryBackend = async (
  mockFn: MockFn,
  createLogger: () => ILogger,
  settings?: CreateMockProteusSettings,
) => {
  const logger = settings?.logger ?? createLogger();

  // Encryption is REAL here — an @Encrypted column is sealed in the store and
  // opened again on read — so a vault is not optional. Minted only when the test
  // brings no `amphora`; its `encryption` selector then fills in only when the
  // test names no key of its own, so an injected `encryption: { kryptos }` still
  // gets the amphora instance the source demands.
  const vault = settings?.amphora ? null : createMockProteusVault(logger);

  const source = new ProteusSource({
    driver: "memory",
    logger,
    amphora: settings?.amphora ?? vault?.amphora,
    cache: settings?.cache,
    encryption: settings?.encryption ?? vault?.encryption,
    entities: settings?.entities,
    meta: settings?.meta,
    naming: settings?.naming,
    namespace: settings?.namespace,
  });

  // Connect BEFORE setup — setup() needs the driver (requireDriver throws
  // otherwise). setup() scans glob-directory entities, registers them, and
  // creates the in-memory tables.
  await source.connect();
  await source.setup();

  // Memory session clones share the same underlying store, so one session backs
  // the session/repository facades; the source facade mints fresh ones per call.
  const session = source.session();

  const spyImpl = (fn: (...args: Array<any>) => any) => {
    const m = mockFn();
    m.mockImplementation(fn);
    return m;
  };

  // ─── Facade repository (memory-backed) ────────────────────────────────

  const wrapRepo = (repo: AnyRepo): AnyRepo => {
    const facade: Record<string, unknown> = {};
    for (const name of REPO_METHODS) {
      facade[name] = spyImpl((...args: Array<any>) => (repo as any)[name](...args));
    }
    return facade as unknown as AnyRepo;
  };

  const makeFacadeRepo = (Entity: Constructor<any>): AnyRepo =>
    wrapRepo(session.repository(Entity));

  // ─── Facade session / source ──────────────────────────────────────────

  const wrapSession = (real: IProteusSession): IProteusSession =>
    ({
      namespace: real.namespace,
      driverType: real.driverType,
      log: real.log,

      hasEntity: spyImpl((Entity: Constructor<any>) => real.hasEntity(Entity)),

      repository: spyImpl((Entity: Constructor<any>) =>
        wrapRepo(real.repository(Entity)),
      ),
      queryBuilder: spyImpl((Entity: Constructor<any>) => real.queryBuilder(Entity)),
      client: spyImpl(() => real.client()),
      transaction: spyImpl((callback: any, options?: any) =>
        real.transaction(callback, options),
      ),
      ping: spyImpl(() => real.ping()),
      flushCache: spyImpl((target?: any) => real.flushCache(target)),

      setFilterParams: spyImpl((name: string, params: any) =>
        real.setFilterParams(name, params),
      ),
      enableFilter: spyImpl((name: string) => real.enableFilter(name)),
      disableFilter: spyImpl((name: string) => real.disableFilter(name)),
      getFilterRegistry: spyImpl(() => real.getFilterRegistry()),

      getEmitEntity: spyImpl(() => (real as any).getEmitEntity()),
    }) as unknown as IProteusSession;

  const makeFacadeSession = (): IProteusSession => wrapSession(session);

  const makeFacadeSource = (): IProteusSource =>
    ({
      namespace: source.namespace,
      driverType: source.driverType,
      migrationsTable: source.migrationsTable,
      log: source.log,
      breaker: source.breaker,

      on: spyImpl((event: any, listener: any) => source.on(event, listener)),
      off: spyImpl((event: any, listener: any) => source.off(event, listener)),
      once: spyImpl((event: any, listener: any) => source.once(event, listener)),

      session: spyImpl((options?: any) => wrapSession(source.session(options))),

      // Lifecycle is already done — these stay inert spies so a stray call cannot
      // tear down / re-create the driver (which would wipe the in-memory store).
      connect: mockFn(),
      disconnect: mockFn(),
      setup: mockFn(),

      ping: spyImpl(() => source.ping()),
      flushCache: spyImpl((target?: any) => source.flushCache(target)),

      addEntities: spyImpl((entities: any) => source.addEntities(entities)),
      stageDecorator: spyImpl((Entity: any, Decorator: any, opts?: any) =>
        source.stageDecorator(Entity, Decorator, opts),
      ),
      stageFieldDecorator: spyImpl(
        (Entity: any, field: any, Decorator: any, opts?: any) =>
          source.stageFieldDecorator(Entity, field, Decorator, opts),
      ),
      getEntityMetadata: spyImpl(() => source.getEntityMetadata()),
      hasEntity: spyImpl((Entity: Constructor<any>) => source.hasEntity(Entity)),

      setFilterParams: spyImpl((name: string, params: any) =>
        source.setFilterParams(name, params),
      ),
      enableFilter: spyImpl((name: string) => source.enableFilter(name)),
      disableFilter: spyImpl((name: string) => source.disableFilter(name)),
      getFilterRegistry: spyImpl(() => source.getFilterRegistry()),

      repository: spyImpl((Entity: Constructor<any>) =>
        wrapRepo(source.repository(Entity)),
      ),
      queryBuilder: spyImpl((Entity: Constructor<any>) => source.queryBuilder(Entity)),
      client: spyImpl(() => source.client()),
      transaction: spyImpl((callback: any, options?: any) =>
        source.transaction(callback, options),
      ),
    }) as unknown as IProteusSource;

  return { makeFacadeRepo, makeFacadeSession, makeFacadeSource };
};

/**
 * A bare spy repository for the NO-ENTITY case (`createMockRepository()` with no
 * decorated entity — e.g. Pylon's boundary-wiring). It has no store: every
 * method is a spy with a trivial default (`count → 1`, `exists → true`,
 * `find → []`, writes echo). Consumers override the methods they exercise.
 */
export const createBareRepository = <E extends IEntity = IEntity>(
  mockFn: MockFn,
): IProteusRepository<E> => {
  const spyImpl = (fn: (...args: Array<any>) => any) => {
    const m = mockFn();
    m.mockImplementation(fn);
    return m;
  };
  const resolves = (value: unknown) => {
    const m = mockFn();
    m.mockResolvedValue(value);
    return m;
  };

  const withId = (options: unknown): unknown => {
    const base: Record<string, unknown> = { ...((options as object) ?? {}) };
    if (base.id == null) base.id = randomUUID();
    return base;
  };

  return {
    // Entity Handlers
    create: spyImpl((options: unknown) => withId(options)),
    copy: spyImpl((entity: unknown) => withId(entity)),
    validate: mockFn(),

    // Queries
    count: resolves(1),
    exists: resolves(true),
    find: resolves([]),
    findAndCount: resolves([[], 0]),
    findOne: resolves(null),
    findOneOrFail: mockFn(),
    findOneOrSave: mockFn(),

    // Upsert
    upsert: spyImpl(async (entity: unknown) => entity),

    // Create/Update/Destroy
    insert: spyImpl(async (entity: unknown) => entity),
    save: spyImpl(async (entity: unknown) => entity),
    update: spyImpl(async (entity: unknown) => entity),
    clone: spyImpl(async (entity: unknown) => ({
      ...((entity as object) ?? {}),
      id: randomUUID(),
    })),
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
    versions: resolves([]),

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
