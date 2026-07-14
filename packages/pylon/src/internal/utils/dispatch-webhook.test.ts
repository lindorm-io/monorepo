import { AesKit } from "@lindorm/aes";
import { Amphora, type IAmphora } from "@lindorm/amphora";
import { type IKryptos, KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import axios from "axios";
import nock from "nock";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

axios.defaults.proxy = false;
import { WebhookAuth, WebhookMethod } from "../../enums/index.js";
import type { IWebhookSubscription } from "../../interfaces/index.js";
import type { PylonEncKey } from "../../types/index.js";
import { createDispatchWebhook } from "./dispatch-webhook.js";

vi.mock("../../middleware/index.js", async () => ({
  createConduitWebhookAuthMiddleware: vi
    .fn()
    .mockResolvedValue(async (_: any, next: any) => {
      await next();
    }),
}));

/**
 * The webhook `clientSecret` is at-rest ciphertext, so it names its own key —
 * and the key it names is the ONLY key that can open it. These tests pin that:
 * the id wins over the deployment's selector, an injected key answers for its own
 * kid alone, and the decrypt floor is applied to whatever the id produced.
 *
 * A REAL vault throughout: the whole point is which key comes back.
 */
describe("createDispatchWebhook", () => {
  let amphora: IAmphora;
  let logger: any;
  let dispatch: { event: string; payload: any; subscription: IWebhookSubscription };
  let scope: nock.Scope;

  const WEBHOOK_KEY: PylonEncKey = {
    predicate: { purpose: "webhook", publish: false },
  };

  const encKey = (options: { expiresAt?: Date; notBefore?: Date } = {}): IKryptos =>
    KryptosKit.generate.enc.oct({
      algorithm: "dir",
      encryption: "A256GCM",
      publish: false,
      purpose: "webhook",
      ...options,
    });

  // Ciphertext is sealed by the RAW kit, never through the vault — that is how a
  // deployment writes the subscription row, and it is what lets a test seal with a
  // key the vault does not hold (or one the floor would refuse).
  const seal = (kryptos: IKryptos, secret = "secret"): string =>
    new AesKit({ kryptos }).encrypt(secret, "tokenised");

  beforeEach(() => {
    amphora = new Amphora({
      domain: "http://test.lindorm.io",
      logger: createMockLogger(),
    });

    logger = createMockLogger();

    dispatch = {
      event: "test_event",
      payload: { key: "value" },
      subscription: {
        id: "08433c77-55d1-5f11-8bb8-8c718a517b71",
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),

        auth: WebhookAuth.Basic,
        event: "test_event",
        method: WebhookMethod.Post,
        headers: {},
        ownerId: "d5555606-ff30-5647-aa10-54be8d2a1086",
        tenantId: null,
        url: "http://test.webhook.com/endpoint",

        authHeaders: {},

        username: "username",
        password: "password",

        audience: null,
        authLocation: null,
        clientId: null,
        clientSecret: null,
        contentType: null,
        issuer: null,
        scope: [],
        tokenUri: null,

        errorCount: 0,
        lastErrorAt: null,
        suspendedAt: null,
      },
    };

    scope = nock("http://test.webhook.com")
      .post("/endpoint")
      .query({ event: "test_event" })
      .times(1)
      .reply(204);
  });

  afterEach(() => {
    vi.useRealTimers();
    nock.cleanAll();
  });

  test("should dispatch without a client secret", async () => {
    await expect(
      createDispatchWebhook({ amphora }, logger)(dispatch),
    ).resolves.toBeUndefined();

    scope.done();
  });

  test("should leave a plaintext client secret untouched", async () => {
    dispatch.subscription.clientSecret = "plaintext-secret";

    await expect(
      createDispatchWebhook({ amphora, encryptionKey: WEBHOOK_KEY }, logger)(dispatch),
    ).resolves.toBeUndefined();

    expect(dispatch.subscription.clientSecret).toBe("plaintext-secret");

    scope.done();
  });

  test("should decrypt with a vault key named by a predicate", async () => {
    const key = encKey();
    amphora.add([key]);

    dispatch.subscription.clientSecret = seal(key);

    await expect(
      createDispatchWebhook({ amphora, encryptionKey: WEBHOOK_KEY }, logger)(dispatch),
    ).resolves.toBeUndefined();

    expect(dispatch.subscription.clientSecret).toBe("secret");

    scope.done();
  });

  // THE BUG. The old code built one `AesKit` from `webhook.encryptionKey` and
  // decrypted every secret with it, ignoring the keyId the ciphertext carries. A
  // predicate matches a key CLASS, not a kid — so with two webhook keys in the
  // vault, the secret has to open with the one that sealed it, not with whichever
  // the selector would have picked.
  test("should decrypt with the key the ciphertext names, not the one the predicate selects", async () => {
    const sealedWith = encKey();
    const other = encKey();
    amphora.add([sealedWith, other]);

    dispatch.subscription.clientSecret = seal(sealedWith);

    await expect(
      createDispatchWebhook({ amphora, encryptionKey: WEBHOOK_KEY }, logger)(dispatch),
    ).resolves.toBeUndefined();

    expect(dispatch.subscription.clientSecret).toBe("secret");

    scope.done();
  });

  // An injected key is the one thing the vault cannot serve: an env-imported KEK
  // that seals webhook secrets and is never added to the amphora.
  test("should decrypt with an injected kryptos the ciphertext names, absent from the vault", async () => {
    const key = encKey();

    dispatch.subscription.clientSecret = seal(key);

    await expect(
      createDispatchWebhook(
        { amphora, encryptionKey: { kryptos: key } },
        logger,
      )(dispatch),
    ).resolves.toBeUndefined();

    expect(dispatch.subscription.clientSecret).toBe("secret");

    scope.done();
  });

  // An injected key answers for its OWN kid, never as a blanket override — or a
  // rotated-in key would shadow every secret the old one sealed.
  test("should refuse an injected kryptos that is not the key the ciphertext names", async () => {
    const sealedWith = encKey();
    const injected = encKey();
    amphora.add([sealedWith]);

    const cipher = seal(sealedWith);
    dispatch.subscription.clientSecret = cipher;

    await expect(
      createDispatchWebhook(
        { amphora, encryptionKey: { kryptos: injected } },
        logger,
      )(dispatch),
    ).rejects.toThrow("Supplied key is not the key the artifact names");

    expect(dispatch.subscription.clientSecret).toBe(cipher);
    expect(scope.isDone()).toBe(false);
  });

  test("should refuse a key the ciphertext names that the vault does not hold", async () => {
    dispatch.subscription.clientSecret = seal(encKey());

    await expect(
      createDispatchWebhook({ amphora, encryptionKey: WEBHOOK_KEY }, logger)(dispatch),
    ).rejects.toThrow("No decryption key satisfies the decryption policy");

    expect(scope.isDone()).toBe(false);
  });

  describe("the decryption floor", () => {
    // The keyId is chosen by whoever wrote the row, so an unfloored lookup lets
    // the ciphertext pick which key in the vault answers for it — a signing key
    // included.
    test("should refuse a sig key named by the ciphertext", async () => {
      const key = encKey();
      const impostor = KryptosKit.generate.sig.oct({
        algorithm: "HS256",
        id: key.id,
        publish: false,
        purpose: "webhook",
      });
      amphora.add([impostor]);

      dispatch.subscription.clientSecret = seal(key);

      await expect(
        createDispatchWebhook({ amphora, encryptionKey: WEBHOOK_KEY }, logger)(dispatch),
      ).rejects.toThrow("Decryption key does not satisfy the decryption policy");

      expect(scope.isDone()).toBe(false);
    });

    // A key whose `notBefore` has not passed cannot have sealed anything, ever, so
    // nothing that names it is trustworthy — even though the raw kit will happily
    // encrypt with it, which is exactly how such a ciphertext comes to exist.
    test("should refuse a key that is not yet valid", async () => {
      const pending = encKey({
        notBefore: new Date("2099-01-01T00:00:00.000Z"),
        expiresAt: new Date("2100-01-01T00:00:00.000Z"),
      });
      amphora.add([pending]);

      dispatch.subscription.clientSecret = seal(pending);

      await expect(
        createDispatchWebhook({ amphora, encryptionKey: WEBHOOK_KEY }, logger)(dispatch),
      ).rejects.toThrow("Decryption key does not satisfy the decryption policy");

      expect(scope.isDone()).toBe(false);
    });

    // THE ROTATION PROPERTY. A secret is sealed once and read for as long as the
    // subscription lives. If the floor demanded `isActive`, minting the next
    // webhook key would break every subscription the current one sealed. This is
    // the test that must never regress.
    //
    // `Amphora.add` refuses an already-expired key, so the only honest way to hold
    // one is the way a deployment gets one: added while valid, then aged.
    test("should still decrypt a secret sealed by a key that has since expired", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-06-01T00:00:00.000Z"));

      const key = encKey({
        notBefore: new Date("2024-01-01T00:00:00.000Z"),
        expiresAt: new Date("2025-01-01T00:00:00.000Z"),
      });
      amphora.add([key]);

      dispatch.subscription.clientSecret = seal(key);

      vi.setSystemTime(new Date("2026-06-01T00:00:00.000Z"));
      expect(key.isExpired).toBe(true);

      await expect(
        createDispatchWebhook({ amphora, encryptionKey: WEBHOOK_KEY }, logger)(dispatch),
      ).resolves.toBeUndefined();

      expect(dispatch.subscription.clientSecret).toBe("secret");

      scope.done();
    });
  });
});
