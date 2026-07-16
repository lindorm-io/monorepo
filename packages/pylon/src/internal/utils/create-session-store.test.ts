import { Aegis } from "@lindorm/aegis";
import { createMockAegis } from "@lindorm/aegis/mocks/vitest";
import { AesKit } from "@lindorm/aes";
import { Amphora, type IAmphora } from "@lindorm/amphora";
import { createMockAmphora } from "@lindorm/amphora/mocks/vitest";
import { type IKryptos, KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import {
  createMockProteusSource,
  createMockRepository,
} from "@lindorm/proteus/mocks/vitest";
import type { IPylonSession } from "../../interfaces/index.js";
import type { PylonCookieSettings } from "../../types/index.js";
import { createSessionStore } from "./create-session-store.js";
import { beforeEach, describe, expect, test, type Mock } from "vitest";

describe("createSessionStore", () => {
  let ctx: any;
  let session: IPylonSession;
  let mockRepo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    mockRepo = createMockRepository();

    const mockProteus = createMockProteusSource();
    mockProteus.repository.mockReturnValue(mockRepo);

    ctx = {
      aegis: createMockAegis(),
      amphora: createMockAmphora(),
      kv: mockProteus,
    };

    session = {
      id: "4f38fec0-70cb-53cb-b82b-42b41e7f986e",
      accessToken: "access-token",
      expiresAt: new Date(Date.now() + 3600000),
      idToken: "id-token",
      issuedAt: new Date(),
      refreshToken: "refresh-token",
      scope: ["openid", "profile", "email", "offline_access"],
      subject: "643881f8-f6b0-5a18-9396-6fbe29ebfec8",
    };

    (mockRepo.upsert as Mock).mockResolvedValue(session);
    (mockRepo.findOne as Mock).mockResolvedValue(session);
    (mockRepo.delete as Mock).mockResolvedValue(undefined);
  });

  test("should resolve undefined when not enabled", () => {
    expect(createSessionStore({ enabled: false })).toBeUndefined();
  });

  test("should resolve undefined when no options", () => {
    expect(createSessionStore()).toBeUndefined();
  });

  test("should resolve store when enabled with keyValue on context", async () => {
    const store = createSessionStore({ enabled: true });

    expect(store).toBeDefined();

    await expect(store!.set(ctx, session)).resolves.toEqual(
      "4f38fec0-70cb-53cb-b82b-42b41e7f986e",
    );

    await expect(store!.get(ctx, session.id)).resolves.toEqual(
      expect.objectContaining({
        id: session.id,
      }),
    );

    await expect(store!.del(ctx, session.id)).resolves.toBeUndefined();

    await expect(store!.logout(ctx, session.subject)).resolves.toBeUndefined();
  });

  test("should fall back to cookie when no keyValue available", async () => {
    ctx.kv = undefined;

    const store = createSessionStore({ enabled: true });

    expect(store).toBeDefined();

    // set returns the session id (no repo to insert into)
    await expect(store!.set(ctx, session)).resolves.toEqual(session.id);

    // get returns null (no repo to query)
    await expect(store!.get(ctx, session.id)).resolves.toBeNull();

    // del and logout are no-ops
    await expect(store!.del(ctx, session.id)).resolves.toBeUndefined();
    await expect(store!.logout(ctx, session.subject)).resolves.toBeUndefined();
  });

  /**
   * Session ENCRYPTION, against a REAL vault and a REAL aegis. A mocked `find`
   * cannot select the wrong key — which is why this bug survived: the store's
   * `aes.encrypt` took no selector, so it resolved through aegis's
   * deployment-wide enc policy, which queries the PUBLISHED set. The internal
   * session key was unreachable and the JWKS token key sealed every session's
   * bearer tokens.
   *
   * The token key is deliberately NEWER than the session key: `amphora.find`
   * returns the newest match, so a vacuous selector resolves to it.
   */
  describe("encryption key selection (real vault)", () => {
    const OLDER = new Date("2024-01-01T00:00:00.000Z");
    const NEWER = new Date("2024-06-01T00:00:00.000Z");
    const ISSUER = "http://test.lindorm.io";

    const sessionKeys: PylonCookieSettings = {
      encryption: { predicate: { purpose: "session", publish: false } },
    };

    let amphora: IAmphora;
    let sessionKey: IKryptos;
    let tokenKey: IKryptos;
    let realCtx: any;

    beforeEach(() => {
      const logger = createMockLogger();

      amphora = new Amphora({ domain: ISSUER, logger });

      sessionKey = KryptosKit.generate.auto({
        algorithm: "ECDH-ES",
        createdAt: OLDER,
        curve: "X448",
        issuer: ISSUER,
        publish: false,
        purpose: "session",
      });

      tokenKey = KryptosKit.generate.auto({
        algorithm: "ECDH-ES+A256GCMKW",
        createdAt: NEWER,
        curve: "X448",
        issuer: ISSUER,
        publish: true,
        purpose: "token",
      });

      amphora.add([sessionKey, tokenKey]);

      realCtx = { aegis: new Aegis({ amphora, logger }), amphora, kv: ctx.kv };
    });

    test("seals the session's tokens with the INTERNAL session key, not the newer PUBLISHED token key", async () => {
      const store = createSessionStore({ enabled: true, ...sessionKeys });

      await store!.set(realCtx, session);

      for (const token of [session.accessToken, session.idToken, session.refreshToken]) {
        expect(AesKit.isAesTokenised(token)).toBe(true);
        expect(AesKit.parse(token!).keyId).toBe(sessionKey.id);
        expect(AesKit.parse(token!).keyId).not.toBe(tokenKey.id);
      }
    });

    // The fail-closed guard: with NO session/cookie enc key configured, encryption
    // at rest is simply OFF — the tokens are stored verbatim. They must never be
    // silently sealed with the vault's default (published) JWKS token key, which
    // is what the old `|| canEncrypt()` fallback did. Asserted so the fix cannot
    // silently revert.
    test("without a configured key the tokens are stored unencrypted, never sealed with the token key", async () => {
      const store = createSessionStore({ enabled: true });

      await store!.set(realCtx, session);

      for (const token of [session.accessToken, session.idToken, session.refreshToken]) {
        expect(AesKit.isAesTokenised(token!)).toBe(false);
      }

      expect(session.accessToken).toBe("access-token");
      expect(session.idToken).toBe("id-token");
      expect(session.refreshToken).toBe("refresh-token");
    });

    // Ciphertext names its own key, so aegis resolves the read side by kid: a
    // session sealed with the OLD key still decrypts after the change.
    test("a session sealed with the OLD key still decrypts", async () => {
      const stale = await realCtx.aegis.aes.encrypt(session.accessToken, "tokenised", {
        key: { predicate: { purpose: "token" } },
      });

      expect(AesKit.parse(stale).keyId).toBe(tokenKey.id);

      (mockRepo.findOne as Mock).mockResolvedValue({ ...session, accessToken: stale });

      const store = createSessionStore({ enabled: true, ...sessionKeys });
      const read = await store!.get(realCtx, session.id);

      expect(read!.accessToken).toBe("access-token");
    });

    // Fail LOUDLY, not silently — a named key the vault does not hold must never
    // degrade into persisting a bearer token in the clear.
    test("throws when the named session enc key is not in the vault", async () => {
      const store = createSessionStore({
        enabled: true,
        encryption: { predicate: { purpose: "no-such-purpose" } },
      });

      await expect(store!.set(realCtx, session)).rejects.toThrow();
      expect(mockRepo.upsert).not.toHaveBeenCalled();
    });
  });
});
