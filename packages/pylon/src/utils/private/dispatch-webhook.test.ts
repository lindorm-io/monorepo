import { AesKit } from "@lindorm/aes";
import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger";
import nock from "nock";
import { WebhookAuth } from "../../enums";
import { IWebhookDispatch } from "../../interfaces";
import { createDispatchWebhook } from "./dispatch-webhook";

jest.mock("../../middleware", () => ({
  createConduitWebhookAuthMiddleware: jest
    .fn()
    .mockResolvedValue(async (_: any, next: any) => {
      await next();
    }),
}));

describe("createDispatchWebhook", () => {
  let options: any;
  let logger: any;
  let dispatch: IWebhookDispatch;
  let scope: nock.Scope;

  beforeEach(() => {
    options = {};

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
        headers: {},
        ownerId: "d5555606-ff30-5647-aa10-54be8d2a1086",
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
      },
    };

    scope = nock("http://test.webhook.com")
      .post("/endpoint")
      .query({ event: "test_event" })
      .times(1)
      .reply(204);
  });

  test("should resolve", async () => {
    await expect(
      createDispatchWebhook(options, logger)(dispatch),
    ).resolves.toBeUndefined();

    scope.done();
  });

  test("should resolve with encrypted key", async () => {
    const kryptos = KryptosKit.generate.enc.oct({
      algorithm: "dir",
      encryption: "A128GCM",
    });

    const aes = new AesKit({ kryptos });

    options.encryptionKey = kryptos;
    dispatch.subscription.clientSecret = aes.encrypt("secret", "tokenised");

    expect(dispatch.subscription.clientSecret).toEqual(
      expect.stringContaining("$A128GCM$"),
    );

    await expect(
      createDispatchWebhook(options, logger)(dispatch),
    ).resolves.toBeUndefined();

    expect(dispatch.subscription.clientSecret).toBe("secret");

    scope.done();
  });
});
