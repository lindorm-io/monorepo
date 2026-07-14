import type { AegisIntrospection, AegisUserinfo, IAegis } from "@lindorm/aegis";
import type { IAmphora } from "@lindorm/amphora";
import type { IConduit } from "@lindorm/conduit";
import type { IHermesSession } from "@lindorm/hermes";
import type { IIrisSession } from "@lindorm/iris";
import type { ILogger } from "@lindorm/logger";
import type { IProteusSession } from "@lindorm/proteus";
import type { DeepPartial, Dict } from "@lindorm/types";
import { merge } from "@lindorm/utils";
import { appendChallenge } from "../internal/utils/challenge/append-challenge.js";
import type {
  PylonAuthClaimsClient,
  PylonChallenge,
  PylonContext,
  PylonHttpContext,
  PylonIoContextHttp,
  PylonState,
} from "../types/index.js";

/**
 * The mock ctx is transport-free, so koa's response object is absent. Middleware that
 * writes response headers (Cache-Control, WWW-Authenticate, ...) needs one: `set` records
 * onto `response.headers` lower-cased, the way koa does, and `response.get` reads it back
 * — so a test can assert the headers a real response would carry.
 */
export type TestPylonCtx = PylonContext & {
  challenge: PylonChallenge;
  response: { headers: Dict<string>; get: (field: string) => string };
  set: (field: string, value: string) => void;
};

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
): TestPylonCtx => {
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

  const headers: Dict<string> = {};

  const ctx: TestPylonCtx = {
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

    response: { headers, get: (field) => headers[field.toLowerCase()] ?? "" },
    set: (field, value) => {
      headers[field.toLowerCase()] = value;
    },

    // The real thing, not a spy — appendChallenge is pure, so a consumer test can assert
    // the WWW-Authenticate a real response would carry.
    challenge: (scheme, params) =>
      appendChallenge(ctx as unknown as PylonHttpContext, scheme, params),
  };

  const db = options.db === undefined ? deps.db : options.db;
  if (db != null) ctx.db = db;

  const kv = options.kv === undefined ? deps.kv : options.kv;
  if (kv != null) ctx.kv = kv;

  if (options.bus) ctx.bus = options.bus;
  if (options.hermes) ctx.hermes = options.hermes;

  return ctx;
};
