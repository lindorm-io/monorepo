import type { AegisIntrospection, AegisUserinfo, IAegis } from "@lindorm/aegis";
import type { IAmphora } from "@lindorm/amphora";
import type { IConduit } from "@lindorm/conduit";
import type { IHermesSession } from "@lindorm/hermes";
import type { IIrisSession } from "@lindorm/iris";
import type { ILogger } from "@lindorm/logger";
import type { IProteusSession } from "@lindorm/proteus";
import type { DeepPartial, Dict } from "@lindorm/types";
import { merge } from "@lindorm/utils";
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
  db: IProteusSession;
  kv: IProteusSession;
};

export type CreateTestPylonCtxOptions = {
  /** ctx.data (default {}). */
  data?: any;
  /** ctx.params (default {}). */
  params?: Dict<string>;
  /** Deep-merged over the rich PylonState defaults. */
  state?: DeepPartial<PylonState>;
  /** Override ctx.db: pass a session, or `null` to omit the mock session. */
  db?: IProteusSession | null;
  /** Override ctx.kv: pass a session, or `null` to omit the mock session. */
  kv?: IProteusSession | null;
  /** ctx.bus — omitted unless provided. */
  bus?: IIrisSession | null;
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

export const _createTestPylonCtx = (
  deps: TestPylonCtxDeps,
  options: CreateTestPylonCtxOptions = {},
): PylonContext => {
  const resolves = (value: any) => {
    const m = deps.mockFn();
    m.mockResolvedValue(value);
    return m;
  };

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

  const db = options.db === undefined ? deps.db : options.db;
  if (db != null) ctx.db = db;

  const kv = options.kv === undefined ? deps.kv : options.kv;
  if (kv != null) ctx.kv = kv;

  if (options.bus) ctx.bus = options.bus;
  if (options.hermes) ctx.hermes = options.hermes;

  return ctx;
};
