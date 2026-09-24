import type { IAegis } from "@lindorm/aegis";
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
  PylonIntrospection,
  PylonIoContextHttp,
  PylonState,
  PylonUserinfo,
} from "../types/index.js";

/**
 * The mock ctx is transport-free, so koa's request/response objects are absent.
 *
 * `response`/`set`: middleware that writes response headers (Cache-Control,
 * WWW-Authenticate, ...) needs one. `set` records onto `response.headers`
 * lower-cased, the way koa does, and `response.get` reads it back — so a test can
 * assert the headers a real response would carry.
 *
 * `request`: what makes the context an HTTP one. Pylon discriminates transports
 * structurally — `isHttpContext` is `"request" in ctx && !("event" in ctx)` — so
 * WITHOUT this every transport-aware middleware answered `unsupported_context`,
 * and a consumer proving its own auth wiring had to hand-roll a context rather
 * than use the mock pylon ships. The three fields are the whole of what
 * `src/middleware/**` reads off `ctx.request`: `ip` (`useRateLimit`) and
 * `ip`/`method`/`path` (`useAuditLog`). Nothing else is added on spec — a test
 * needing a different value assigns it (`ctx.request.ip = "10.0.0.1"`).
 *
 * `auth`: each member INTERSECTED with the mock type, so `ctx.auth.introspect`
 * is simultaneously the real `PylonAuthClaimsClient` member the middleware chain
 * consumes and a mock a test can re-programme — `ctx.auth.introspect
 * .mockResolvedValue(...)` with no cast. The methods were always mocks; only the
 * TYPE said otherwise, and the cast that closed the gap is the kind a consumer
 * writes once and then reaches for everywhere.
 *
 * `MockFn` is a parameter rather than a vitest import because this file serves
 * BOTH wrappers; `mocks/vitest.ts` and `mocks/jest.ts` each bind it to their own
 * mock type under this same name, so a consumer never spells the parameter.
 *
 * ⚠ The mapped type is EXHAUSTIVE over `PylonAuthClaimsClient` on purpose: a
 * member added to that client makes the object literal in the factory below fail
 * to compile, rather than leaving the mock quietly short of the real surface.
 */
export type TestPylonCtx<MockFn = unknown> = PylonContext & {
  auth: { [K in keyof PylonAuthClaimsClient]: PylonAuthClaimsClient[K] & MockFn };
  challenge: PylonChallenge;
  request: { ip: string; method: string; path: string };
  response: { headers: Dict<string>; get: (field: string) => string };
  set: (field: string, value: string) => void;
  /**
   * The request-header reader, as a MOCK. Koa answers `""` for a header that is
   * not there, so that is the default — an inert starting point, not an opinion.
   *
   * A test that needs a header states it: `ctx.get.mockReturnValue("DPoP …")`,
   * or `mockImplementation` to answer per field. That is the point of this
   * fixture — it is the BASELINE, and each test adds what it needs to prove its
   * own case. Do not grow this factory to anticipate every header a caller might
   * read; a field nobody sets here is not a gap.
   */
  get: ((field: string) => string) & MockFn;
};

export type TestPylonCtxDeps<MockFn = any> = {
  mockFn: () => MockFn;
  aegis: IAegis;
  amphora: IAmphora;
  logger: ILogger;
  conduit: IConduit;
  db: IProteusSession;
  kv: IProteusSession;
  cache: IProteusSession;
};

export type CreateTestPylonCtxOptions = {
  /** ctx.data (default {}). */
  data?: any;
  /** ctx.params (default {}). */
  params?: Dict<string>;
  /** Deep-merged over the rich PylonState defaults. */
  state?: DeepPartial<PylonState>;
  /**
   * Override ctx.aegis with a REAL Aegis. The default mock returns canned values, which
   * is right for a consumer that only needs a token-shaped answer — but a test of the
   * mint/verify path itself needs a genuine signature over a genuine key, and a mock
   * cannot give one. Not nullable: `ctx.aegis` is non-optional on the context.
   */
  aegis?: IAegis;
  /** Override ctx.amphora with a real Amphora — same reasoning as `aegis`. */
  amphora?: IAmphora;
  /** Override ctx.db: pass a session, or `null` to omit the mock session. */
  db?: IProteusSession | null;
  /** Override ctx.kv: pass a session, or `null` to omit the mock session. */
  kv?: IProteusSession | null;
  /**
   * Override ctx.cache: pass a session, or `null` to omit the mock session. A
   * DISTINCT session from `kv` by default, so a test can prove which store a
   * consumer wrote to.
   */
  cache?: IProteusSession | null;
  /** ctx.bus — omitted unless provided. */
  bus?: IIrisSession | null;
  /** ctx.hermes — omitted unless provided. */
  hermes?: IHermesSession | null;
};

const defaultState = (): PylonState => ({
  access: null,
  actor: "test-actor",
  app: {
    // Features OFF, auth ON: a consumer test wants `ctx.auth.introspect` to
    // answer without also opting into audit writes or deployment-wide limits.
    // The identity is what a driver-response cache would key on.
    //
    // ⚠ `rateLimit` has no off state: the block is policy and mounting
    // `useRateLimit` is the switch, so this is the resolution of an absent block
    // — imposing nothing, which a mount must bound itself against.
    config: {
      audit: false,
      rateLimit: { strategy: "fixed", window: null, max: null },
      auth: {
        issuer: "http://localhost:3000",
        clientId: "test-client",
        capabilities: { introspect: true, userinfo: true },
        cache: false,
        critical: [],
      },
    },
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

export const _createTestPylonCtx = <MockFn>(
  deps: TestPylonCtxDeps<MockFn>,
  options: CreateTestPylonCtxOptions = {},
): TestPylonCtx<MockFn> => {
  /**
   * A mock pre-set to resolve `value`, returned INTERSECTED with the call
   * signature it stands in for — which is what lets one value satisfy both the
   * real context member and the mock API a test drives it through.
   *
   * The two casts are this file's only assumption about the mock framework:
   * `mockResolvedValue` is the one method both wrappers' mock types provide, and
   * naming a framework here instead would mean two copies of the whole factory.
   */
  const resolves = <T>(value: T): MockFn & ((...args: Array<any>) => Promise<T>) => {
    const mock = deps.mockFn() as MockFn & { mockResolvedValue(value: T): unknown };
    mock.mockResolvedValue(value);
    return mock as MockFn & ((...args: Array<any>) => Promise<T>);
  };

  /** The synchronous twin of `resolves`, for a member that returns a value. */
  const returns = <T>(value: T): MockFn & ((...args: Array<any>) => T) => {
    const mock = deps.mockFn() as MockFn & { mockReturnValue(value: T): unknown };
    mock.mockReturnValue(value);
    return mock as MockFn & ((...args: Array<any>) => T);
  };

  // Annotated with the mapped type, NOT with `PylonAuthClaimsClient`: that is
  // what makes a member added to the client a compile error here.
  const auth: TestPylonCtx<MockFn>["auth"] = {
    introspect: resolves<PylonIntrospection>({ active: false }),
    userinfo: resolves<PylonUserinfo>({ subject: "test-actor" }),
  };

  const state = merge(
    defaultState() as unknown as Dict,
    (options.state ?? {}) as Dict,
  ) as unknown as PylonState;

  const headers: Dict<string> = {};

  const ctx: TestPylonCtx<MockFn> = {
    aegis: options.aegis ?? deps.aegis,
    amphora: options.amphora ?? deps.amphora,
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

    request: { ip: "127.0.0.1", method: "GET", path: "/" },
    // Koa answers "" for an absent header — the inert default. A test that needs
    // one says so itself.
    get: returns(""),
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

  const cache = options.cache === undefined ? deps.cache : options.cache;
  if (cache != null) ctx.cache = cache;

  if (options.bus) ctx.bus = options.bus;
  if (options.hermes) ctx.hermes = options.hermes;

  return ctx;
};
