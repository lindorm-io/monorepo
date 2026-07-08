import type { AegisIntrospection, AegisUserinfo, IAegis } from "@lindorm/aegis";
import type { IAmphora } from "@lindorm/amphora";
import type { IConduit } from "@lindorm/conduit";
import type { IHermesSession } from "@lindorm/hermes";
import type { IIrisSession } from "@lindorm/iris";
import type { ILogger } from "@lindorm/logger";
import type { IEntity, IProteusSession, IProteusSource } from "@lindorm/proteus";
import { ProteusSource } from "@lindorm/proteus";
import type { Constructor, DeepPartial, Dict } from "@lindorm/types";
import { merge } from "@lindorm/utils";
import { PYLON_BUILTIN_ENTITIES } from "../entities/index.js";
import type {
  PylonAuthClaimsClient,
  PylonContext,
  PylonIoContextHttp,
  PylonState,
} from "../types/index.js";

export type TestPylonCtxDeps = {
  mockFn: () => any;
  aegis: IAegis;
  amphora: IAmphora;
  logger: ILogger;
  conduit: IConduit;
};

export type CreateTestPylonCtxOptions = {
  /**
   * Caller's entities — registered on the memory source alongside Pylon's
   * built-ins. Accepts entity classes AND directory/glob path strings (resolved
   * via the scanner at setup), so a generated fixture can point at the same
   * entity dir the ProteusSource uses (e.g. `join(import.meta.dirname, "entities")`).
   */
  entities?: Array<Constructor<IEntity> | string>;
  /** ctx.data (default {}). */
  data?: any;
  /** ctx.params (default {}). */
  params?: Dict<string>;
  /** Deep-merged over the rich PylonState defaults. */
  state?: DeepPartial<PylonState>;
  /** Override ctx.db: pass a session, or `null` to omit the real memory session. */
  db?: IProteusSession | null;
  /** Override ctx.kv: pass a session, or `null` to omit the real memory session. */
  kv?: IProteusSession | null;
  /** ctx.iris — omitted unless provided. */
  iris?: IIrisSession | null;
  /** ctx.hermes — omitted unless provided. */
  hermes?: IHermesSession | null;
};

const defaultState = (): PylonState => ({
  actor: "test-actor",
  app: {
    config: { audit: false, cache: false, rateLimit: false },
    domain: "http://localhost:3000",
    environment: "test",
    name: "test",
    version: "0.0.0",
  },
  authorization: { type: "none", value: null },
  client: {
    userAgent: { raw: null, browser: null, os: null, deviceType: "unknown" },
    app: null,
    build: null,
    channel: null,
    device: null,
    platform: null,
    timezone: null,
  },
  metadata: {
    id: "test-id",
    correlationId: "test-correlation-id",
    date: new Date(0),
    environment: "test",
  },
  tokens: {},
});

export const _createTestPylonCtx = async (
  deps: TestPylonCtxDeps,
  options: CreateTestPylonCtxOptions = {},
): Promise<PylonContext> => {
  const resolves = (value: any) => {
    const m = deps.mockFn();
    m.mockResolvedValue(value);
    return m;
  };

  const needSource = options.db === undefined || options.kv === undefined;

  let source: IProteusSource | undefined;

  if (needSource) {
    source = new ProteusSource({
      driver: "memory",
      logger: deps.logger,
      amphora: deps.amphora,
      entities: [...PYLON_BUILTIN_ENTITIES, ...(options.entities ?? [])],
    });

    await source.connect();
    await source.setup();
  }

  const resolveSession = (
    override: IProteusSession | null | undefined,
  ): IProteusSession | null =>
    override === undefined ? source!.session({ logger: deps.logger }) : override;

  const db = resolveSession(options.db);
  const kv = resolveSession(options.kv);

  const auth: PylonAuthClaimsClient = {
    introspect: resolves({ active: false } as AegisIntrospection),
    userinfo: resolves({ subject: "test-actor" } as AegisUserinfo),
  };

  const state = merge(
    defaultState() as unknown as Dict,
    (options.state ?? {}) as Dict,
  ) as unknown as PylonState;

  const ctx: PylonContext = {
    aegis: deps.aegis,
    amphora: deps.amphora,
    auth,
    conduits: { conduit: deps.conduit },
    entities: {},
    logger: deps.logger,
    state,
    queue: resolves(undefined),
    webhook: resolves(undefined),

    data: options.data ?? {},
    io: {} as PylonIoContextHttp,
    params: options.params ?? {},
  };

  if (db) ctx.db = db;
  if (kv) ctx.kv = kv;
  if (options.iris) ctx.iris = options.iris;
  if (options.hermes) ctx.hermes = options.hermes;

  return ctx;
};
