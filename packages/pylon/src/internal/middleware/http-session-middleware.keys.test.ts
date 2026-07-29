import { Aegis } from "@lindorm/aegis";
import { AesKit } from "@lindorm/aes";
import { Amphora, type IAmphora } from "@lindorm/amphora";
import { type IKryptos, KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import {
  createMockProteusSource,
  createMockRepository,
} from "@lindorm/proteus/mocks/vitest";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import type { IPylonSession } from "../../interfaces/index.js";
import type { PylonCookieSettings, PylonSessionSettings } from "../../types/index.js";
import { createHttpCookiesMiddleware } from "./http-cookies-middleware.js";
import { createHttpSessionMiddleware } from "./http-session-middleware.js";

/**
 * A deployment's two flat key scopes: `cookies` and `session`. Under the
 * settings-declare-keys / configured-key-⇒-default-on model, naming a role's key
 * is what turns it on — there are no `encrypted`/`signed` session booleans, and
 * verification is DERIVED from the signature predicate.
 */
type Keys = { cookie?: PylonCookieSettings; session?: PylonCookieSettings };

/**
 * The session key CHAIN — `session.<role> ?? cookie.<role>` — end to end, through
 * the real cookie middleware, a real aegis and a real vault.
 *
 * A pylon session IS a cookie: with a kv store the cookie carries the id and the
 * tokens are sealed at rest; without one the whole session object travels IN the
 * cookie. Both paths run through `ctx.cookies.set`, so both must reach the keys
 * the deployment named for the SESSION — and every other cookie must keep using
 * the cookie keys.
 *
 * Mocked keys cannot select the wrong key, which is the entire failure mode here.
 * Everything below asserts a real `kid` off a real header.
 */
const ISSUER = "http://test.lindorm.io";

const OLDER = new Date("2024-01-01T00:00:00.000Z");
const NEWER = new Date("2024-06-01T00:00:00.000Z");

const COOKIE_KEYS: PylonCookieSettings = {
  signature: { predicate: { purpose: "cookie", publish: false } },
  encryption: { predicate: { purpose: "cookie", publish: false } },
};

const SESSION_KEYS: PylonCookieSettings = {
  signature: { predicate: { purpose: "session", publish: false } },
  encryption: { predicate: { purpose: "session", publish: false } },
};

const session = (): IPylonSession => ({
  id: "4f38fec0-70cb-53cb-b82b-42b41e7f986e",
  accessToken: "access-token",
  expiresAt: new Date("2024-12-01T00:00:00.000Z"),
  idToken: "id-token",
  issuedAt: new Date("2024-11-01T00:00:00.000Z"),
  refreshToken: "refresh-token",
  scope: ["openid"],
  subject: "643881f8-f6b0-5a18-9396-6fbe29ebfec8",
});

type Ctx = {
  aegis: Aegis;
  amphora: IAmphora;
  get: Mock;
  set: Mock;
  logger: ReturnType<typeof createMockLogger>;
  state: any;
  kv?: any;
  cookies?: any;
  session?: any;
};

/** The set-cookie headers, split into a `name -> value` map. */
const setCookies = (ctx: Ctx): Record<string, string> => {
  const headers = (ctx.set.mock.calls[0]?.[1] ?? []) as Array<string>;

  return headers.reduce<Record<string, string>>((acc, header) => {
    const [pair] = header.split(";");
    const index = pair.indexOf("=");
    acc[pair.slice(0, index)] = pair.slice(index + 1);
    return acc;
  }, {});
};

/** Feed the set-cookie headers of one request back in as the next request's `cookie`. */
const cookieHeader = (ctx: Ctx): string =>
  Object.entries(setCookies(ctx))
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");

describe("httpSessionMiddleware — key chain (real vault)", () => {
  let amphora: IAmphora;
  let cookieSigKey: IKryptos;
  let cookieEncKey: IKryptos;
  let sessionSigKey: IKryptos;
  let sessionEncKey: IKryptos;
  let tokenSigKey: IKryptos;
  let tokenEncKey: IKryptos;
  let repository: Awaited<ReturnType<typeof createMockRepository>>;

  const buildCtx = (cookie = ""): Ctx => {
    const logger = createMockLogger();

    return {
      aegis: new Aegis({ amphora, logger }),
      amphora,
      get: vi.fn().mockReturnValue(cookie),
      set: vi.fn(),
      logger,
      state: { metadata: {}, tokens: {} },
    };
  };

  /** Cookies middleware + session middleware, exactly as `PylonHttp` composes them. */
  const run = async (
    ctx: Ctx,
    keys: Keys,
    options: PylonSessionSettings,
    handler: () => Promise<void>,
  ): Promise<void> => {
    const cookies = createHttpCookiesMiddleware(keys.cookie);
    const middleware = createHttpSessionMiddleware(
      { ...options, ...keys.session },
      keys.cookie,
    );

    await cookies(ctx as any, async () => {
      await middleware(ctx as any, handler);
    });
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    amphora = new Amphora({ domain: ISSUER, logger: createMockLogger() });

    cookieSigKey = KryptosKit.generate.auto({
      algorithm: "HS256",
      createdAt: OLDER,
      issuer: ISSUER,
      publish: false,
      purpose: "cookie",
    });

    cookieEncKey = KryptosKit.generate.auto({
      algorithm: "dir",
      createdAt: OLDER,
      issuer: ISSUER,
      publish: false,
      purpose: "cookie",
    });

    // An ASYMMETRIC signature for session cookies specifically — one of the two
    // reasons a deployment names session keys at all (the other: blast radius).
    sessionSigKey = KryptosKit.generate.auto({
      algorithm: "EdDSA",
      createdAt: OLDER,
      curve: "Ed448",
      issuer: ISSUER,
      publish: false,
      purpose: "session",
    });

    sessionEncKey = KryptosKit.generate.auto({
      algorithm: "ECDH-ES",
      createdAt: OLDER,
      curve: "X448",
      issuer: ISSUER,
      publish: false,
      purpose: "session",
    });

    // The PUBLISHED token keys are deliberately NEWER: amphora's default query is
    // the published set and `find` returns the newest match, so a vacuous
    // selector resolves to these. That is what makes these tests able to fail.
    tokenSigKey = KryptosKit.generate.auto({
      algorithm: "EdDSA",
      createdAt: NEWER,
      curve: "Ed25519",
      issuer: ISSUER,
      publish: true,
      purpose: "token",
    });

    tokenEncKey = KryptosKit.generate.auto({
      algorithm: "ECDH-ES+A256GCMKW",
      createdAt: NEWER,
      curve: "X448",
      issuer: ISSUER,
      publish: true,
      purpose: "token",
    });

    amphora.add([
      cookieSigKey,
      cookieEncKey,
      sessionSigKey,
      sessionEncKey,
      tokenSigKey,
      tokenEncKey,
    ]);

    repository = await createMockRepository();
    (repository.upsert as Mock).mockImplementation(
      async (entity: IPylonSession) => entity,
    );
  });

  describe("the chain", () => {
    // No `session` block at all: one set of keys does everything.
    test("a session with NO session keys signs and seals with the COOKIE keys", async () => {
      const ctx = buildCtx();

      await run(ctx, { cookie: COOKIE_KEYS }, { enabled: false }, async () => {
        await ctx.session.set(session());
      });

      const cookies = setCookies(ctx);

      expect(cookies["pylon_session.kid"]).toBe(cookieSigKey.id);
      expect(AesKit.parse(cookies["pylon_session"]).keyId).toBe(cookieEncKey.id);

      expect(cookies["pylon_session.kid"]).not.toBe(tokenSigKey.id);
      expect(AesKit.parse(cookies["pylon_session"]).keyId).not.toBe(tokenEncKey.id);
    });

    // A `session` block: the session cookie gets its OWN key, every other cookie
    // keeps the cookie key. The seam is per-cookie, so pylon never has to know
    // which cookie name means "session".
    test("a session WITH its own keys uses them, while an ordinary cookie still uses the COOKIE keys", async () => {
      const ctx = buildCtx();

      await run(
        ctx,
        { cookie: COOKIE_KEYS, session: SESSION_KEYS },
        { enabled: false },
        async () => {
          await ctx.session.set(session());
          await ctx.cookies.set(
            "preferences",
            { theme: "dark" },
            {
              encryption: true,
              signature: true,
            },
          );
        },
      );

      const cookies = setCookies(ctx);

      expect(cookies["pylon_session.kid"]).toBe(sessionSigKey.id);
      expect(AesKit.parse(cookies["pylon_session"]).keyId).toBe(sessionEncKey.id);

      expect(cookies["preferences.kid"]).toBe(cookieSigKey.id);
      expect(AesKit.parse(cookies["preferences"]).keyId).toBe(cookieEncKey.id);
    });

    // Roles chain INDEPENDENTLY — a session that names only its encryption key
    // still signs with the cookie key.
    test("chains role by role — a session naming only `encryption` still signs with the COOKIE key", async () => {
      const ctx = buildCtx();

      await run(
        ctx,
        { cookie: COOKIE_KEYS, session: { encryption: SESSION_KEYS!.encryption } },
        { enabled: false },
        async () => {
          await ctx.session.set(session());
        },
      );

      const cookies = setCookies(ctx);

      expect(cookies["pylon_session.kid"]).toBe(cookieSigKey.id);
      expect(AesKit.parse(cookies["pylon_session"]).keyId).toBe(sessionEncKey.id);
    });
  });

  describe("rollover", () => {
    // The everyday case, and the one the rotation worker creates every year: a
    // NEW cookie signing key is minted under the SAME purpose, so `find` starts
    // returning it. Live cookies signed by the previous key must keep working —
    // and they do, because a signature is resolved against the key the cookie's
    // own `.kid` names, and the verification predicate matches a key CLASS, not
    // a kid.
    test("rotating the signing key does not invalidate live cookies", async () => {
      const before = buildCtx();

      await run(before, { cookie: COOKIE_KEYS }, { enabled: false }, async () => {
        await before.session.set(session());
      });

      expect(setCookies(before)["pylon_session.kid"]).toBe(cookieSigKey.id);

      // The rotation worker mints the next cookie signing key. It is NEWER, so
      // it now wins the signing query — the live cookie above still names the old.
      const rotated = KryptosKit.generate.auto({
        algorithm: "HS256",
        createdAt: NEWER,
        issuer: ISSUER,
        publish: false,
        purpose: "cookie",
      });

      amphora.add(rotated);

      const after = buildCtx(cookieHeader(before));

      await run(after, { cookie: COOKIE_KEYS }, { enabled: false }, async () => {
        // A fresh write picks the rotated key…
        await after.session.set(session());
      });

      // …and the cookie the OLD key signed still read back cleanly.
      expect(after.state.session).toEqual(
        expect.objectContaining({ id: session().id, subject: session().subject }),
      );
      expect(setCookies(after)["pylon_session.kid"]).toBe(rotated.id);
    });

    // THE CONTRACT. Verification inherits the signing policy, so a session
    // signing key is the ONLY thing a deployment has to name. There is no second
    // option to forget, and therefore no way to configure a session cookie that
    // signs but cannot be read.
    test("naming `session.signature` ALONE is sufficient — the session cookie signs AND reads back", async () => {
      const keys: Keys = {
        cookie: COOKIE_KEYS,
        session: { signature: SESSION_KEYS!.signature },
      };

      const write = buildCtx();

      await run(write, keys, { enabled: false }, async () => {
        await write.session.set(session());
      });

      expect(setCookies(write)["pylon_session.kid"]).toBe(sessionSigKey.id);

      const read = buildCtx(cookieHeader(write));

      await run(read, keys, { enabled: false }, async () => {});

      expect(read.state.session).toEqual(
        expect.objectContaining({ id: session().id, subject: session().subject }),
      );
    });

    // An injected `kryptos` has no predicate to inherit. We do NOT synthesise one
    // from the key's attributes — the floor (`use: "sig"`) applies alone, and the
    // cookie's `.kid` names the key. Crucially the check does NOT fall through to
    // the COOKIE predicate, which the injected session key would fail.
    test("an injected `session.signature` kryptos verifies against the floor alone", async () => {
      const injected = KryptosKit.generate.auto({
        algorithm: "HS256",
        createdAt: OLDER,
        issuer: ISSUER,
        publish: false,
        purpose: "ad-hoc-not-in-any-predicate",
      });

      amphora.add(injected);

      const keys: Keys = {
        cookie: COOKIE_KEYS,
        session: { signature: { kryptos: injected } },
      };

      const write = buildCtx();

      await run(write, keys, { enabled: false }, async () => {
        await write.session.set(session());
      });

      expect(setCookies(write)["pylon_session.kid"]).toBe(injected.id);

      const read = buildCtx(cookieHeader(write));

      await run(read, keys, { enabled: false }, async () => {});

      expect(read.state.session).toEqual(expect.objectContaining({ id: session().id }));
    });
  });

  describe("where the data lives", () => {
    // No store: the WHOLE session — tokens and all — is the cookie's value. The
    // resolved session encryption key is the only thing protecting it.
    test("cookie-only session — the session DATA is sealed with the resolved session enc key", async () => {
      const ctx = buildCtx();

      await run(
        ctx,
        { cookie: COOKIE_KEYS, session: SESSION_KEYS },
        { enabled: false },
        async () => {
          await ctx.session.set(session());
        },
      );

      const value = setCookies(ctx)["pylon_session"];

      expect(AesKit.parse(value).keyId).toBe(sessionEncKey.id);

      // The tokens really are IN the cookie — this is what the key is protecting.
      const decrypted = await ctx.aegis.aes.decrypt<IPylonSession>(value);

      expect(decrypted).toEqual(
        expect.objectContaining({
          id: session().id,
          accessToken: "access-token",
          refreshToken: "refresh-token",
        }),
      );
    });

    // With a store: the cookie carries only the id, and the tokens are sealed at
    // rest — with the SAME resolved session key. Same secret, two places. Under
    // the new model a configured session enc key seals the ID-carrying cookie too
    // (the toggle is the key's presence, not a separate `encrypted` boolean), so
    // the cookie value is a sealed token that decrypts back to the session id.
    test("kv session — the cookie carries the (sealed) id, the record's tokens are sealed with the resolved session enc key", async () => {
      const ctx = buildCtx();
      const kv = await createMockProteusSource();
      kv.repository.mockReturnValue(repository);
      ctx.kv = kv;

      await run(
        ctx,
        { cookie: COOKIE_KEYS, session: SESSION_KEYS },
        { enabled: true },
        async () => {
          await ctx.session.set(session());
        },
      );

      const value = setCookies(ctx)["pylon_session"];

      expect(AesKit.isAesString(value)).toBe(true);
      expect(AesKit.parse(value).keyId).toBe(sessionEncKey.id);
      await expect(ctx.aegis.aes.decrypt(value)).resolves.toBe(session().id);
      expect(setCookies(ctx)["pylon_session.kid"]).toBe(sessionSigKey.id);

      const [persisted] = (repository.upsert as Mock).mock.calls[0] as [IPylonSession];

      for (const token of [
        persisted.accessToken,
        persisted.idToken,
        persisted.refreshToken,
      ]) {
        expect(AesKit.isAesString(token)).toBe(true);
        expect(AesKit.parse(token!).keyId).toBe(sessionEncKey.id);
        expect(AesKit.parse(token!).keyId).not.toBe(tokenEncKey.id);
      }
    });
  });

  // FAIL-CLOSED. Naming a signing key that the vault does not hold is the on-off
  // for a signed session under the new model — and it must fail LOUDLY, never
  // fall back to the floor alone (which resolves to the newest published key, the
  // JWKS token key, the bug the selector exists to remove).
  test("throws loudly when the named session signing key cannot be resolved", async () => {
    const ctx = buildCtx();

    await expect(
      run(
        ctx,
        { cookie: { signature: { predicate: { purpose: "no-such-purpose" } } } },
        { enabled: false },
        async () => {
          await ctx.session.set(session());
        },
      ),
    ).rejects.toThrow(/signing key/i);

    expect(ctx.set).not.toHaveBeenCalled();
  });

  // FAIL-CLOSED (the #13 contract, under the split): a session whose encryption
  // key is NAMED but unresolvable must reach the THROWING resolver, never fall
  // through to a silent plaintext write.
  test("throws loudly when the named session encryption key cannot be resolved", async () => {
    const ctx = buildCtx();

    await expect(
      run(
        ctx,
        { cookie: { encryption: { predicate: { purpose: "no-such-purpose" } } } },
        { enabled: false },
        async () => {
          await ctx.session.set(session());
        },
      ),
    ).rejects.toThrow(/encryption key/i);

    expect(ctx.set).not.toHaveBeenCalled();
  });
});
