import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import axios from "axios";
import nock from "nock";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

axios.defaults.proxy = false;
import { WebhookAuth, WebhookMethod } from "../../enums/index.js";
import type { IWebhookSubscription } from "../../interfaces/index.js";
import { createDispatchWebhook } from "./dispatch-webhook.js";

vi.mock("../../middleware/index.js", async () => ({
  createConduitWebhookAuthMiddleware: vi
    .fn()
    .mockResolvedValue(async (_: any, next: any) => {
      await next();
    }),
}));

/**
 * `clientSecret` is a proteus `@Encrypted` column now: proteus decrypts it on
 * read, so the subscription reaches dispatch in the clear. Dispatch does NO
 * crypto of its own — it only fans the payload to the subscription URL. These
 * tests pin exactly that: a plaintext secret is left untouched and the HTTP
 * method routes correctly.
 */
describe("createDispatchWebhook", () => {
  let logger: any;
  let dispatch: { event: string; payload: any; subscription: IWebhookSubscription };
  let scope: nock.Scope;

  const baseSubscription = (): IWebhookSubscription => ({
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
  });

  beforeEach(() => {
    logger = createMockLogger();

    dispatch = {
      event: "test_event",
      payload: { key: "value" },
      subscription: baseSubscription(),
    };
  });

  afterEach(() => {
    nock.cleanAll();
  });

  test("should dispatch without a client secret", async () => {
    scope = nock("http://test.webhook.com")
      .post("/endpoint")
      .query({ event: "test_event" })
      .reply(204);

    await expect(createDispatchWebhook(logger)(dispatch)).resolves.toBeUndefined();

    scope.done();
  });

  test("should leave a plaintext client secret untouched (no crypto)", async () => {
    scope = nock("http://test.webhook.com")
      .post("/endpoint")
      .query({ event: "test_event" })
      .reply(204);

    dispatch.subscription.clientSecret = "plaintext-secret";

    await expect(createDispatchWebhook(logger)(dispatch)).resolves.toBeUndefined();

    expect(dispatch.subscription.clientSecret).toBe("plaintext-secret");

    scope.done();
  });

  test("should dispatch with PUT when the subscription method is Put", async () => {
    scope = nock("http://test.webhook.com")
      .put("/endpoint")
      .query({ event: "test_event" })
      .reply(204);

    dispatch.subscription.method = WebhookMethod.Put;

    await expect(createDispatchWebhook(logger)(dispatch)).resolves.toBeUndefined();

    scope.done();
  });

  test("should dispatch with PATCH when the subscription method is Patch", async () => {
    scope = nock("http://test.webhook.com")
      .patch("/endpoint")
      .query({ event: "test_event" })
      .reply(204);

    dispatch.subscription.method = WebhookMethod.Patch;

    await expect(createDispatchWebhook(logger)(dispatch)).resolves.toBeUndefined();

    scope.done();
  });
});
