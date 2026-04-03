import {
  conduitBasicAuthMiddleware,
  conduitClientCredentialsMiddlewareFactory,
  ConduitError,
  conduitHeadersMiddleware,
} from "@lindorm/conduit";
import { WebhookAuth } from "../../enums";
import { IWebhookSubscription } from "../../interfaces";
import { createConduitWebhookAuthMiddleware } from "./conduit-webhook-auth-middleware";

jest.mock("@lindorm/conduit", () => {
  const actual = jest.requireActual("@lindorm/conduit");
  return {
    ...actual,
    conduitBasicAuthMiddleware: jest.fn().mockReturnValue(jest.fn()),
    conduitClientCredentialsMiddlewareFactory: jest
      .fn()
      .mockReturnValue(jest.fn().mockResolvedValue(jest.fn())),
    conduitHeadersMiddleware: jest.fn().mockReturnValue(jest.fn()),
  };
});

describe("createConduitWebhookAuthMiddleware", () => {
  let cache: any;

  beforeEach(() => {
    jest.clearAllMocks();
    cache = {};
  });

  const createSubscription = (
    overrides: Partial<IWebhookSubscription> = {},
  ): IWebhookSubscription => ({
    id: "sub-id",
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    auth: WebhookAuth.None,
    event: "test.event",
    headers: {},
    ownerId: "owner-id",
    url: "https://test.webhook.com/endpoint",
    authHeaders: {},
    username: null,
    password: null,
    audience: null,
    authLocation: null,
    clientId: null,
    clientSecret: null,
    contentType: null,
    issuer: null,
    scope: [],
    tokenUri: null,
    ...overrides,
  });

  test("should return empty middleware for WebhookAuth.None", async () => {
    const subscription = createSubscription({ auth: WebhookAuth.None });
    const middleware = await createConduitWebhookAuthMiddleware(subscription, cache);

    const next = jest.fn();
    await middleware({} as any, next);

    expect(next).toHaveBeenCalled();
  });

  test("should return headers middleware for WebhookAuth.AuthHeaders", async () => {
    const subscription = createSubscription({
      auth: WebhookAuth.AuthHeaders,
      authHeaders: { "X-API-Key": "test-key-value" },
    });

    await createConduitWebhookAuthMiddleware(subscription, cache);

    expect(conduitHeadersMiddleware).toHaveBeenCalledWith({
      "X-API-Key": "test-key-value",
    });
  });

  test("should throw ConduitError for AuthHeaders with empty headers", async () => {
    const subscription = createSubscription({
      auth: WebhookAuth.AuthHeaders,
      authHeaders: {},
    });

    await expect(createConduitWebhookAuthMiddleware(subscription, cache)).rejects.toThrow(
      ConduitError,
    );
  });

  test("should return basic auth middleware for WebhookAuth.Basic", async () => {
    const subscription = createSubscription({
      auth: WebhookAuth.Basic,
      username: "test-user",
      password: "test-pass",
    });

    await createConduitWebhookAuthMiddleware(subscription, cache);

    expect(conduitBasicAuthMiddleware).toHaveBeenCalledWith("test-user", "test-pass");
  });

  test("should throw ConduitError for Basic with missing username", async () => {
    const subscription = createSubscription({
      auth: WebhookAuth.Basic,
      username: null,
      password: "test-pass",
    });

    await expect(createConduitWebhookAuthMiddleware(subscription, cache)).rejects.toThrow(
      ConduitError,
    );
  });

  test("should throw ConduitError for Basic with missing password", async () => {
    const subscription = createSubscription({
      auth: WebhookAuth.Basic,
      username: "test-user",
      password: null,
    });

    await expect(createConduitWebhookAuthMiddleware(subscription, cache)).rejects.toThrow(
      ConduitError,
    );
  });

  test("should return client credentials middleware for WebhookAuth.ClientCredentials", async () => {
    const subscription = createSubscription({
      auth: WebhookAuth.ClientCredentials,
      clientId: "client-id",
      clientSecret: "client-secret",
      issuer: "https://test.lindorm.io",
      audience: "test-audience",
      scope: ["read", "write"],
    });

    await createConduitWebhookAuthMiddleware(subscription, cache);

    expect(conduitClientCredentialsMiddlewareFactory).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "client-id",
        clientSecret: "client-secret",
        issuer: "https://test.lindorm.io",
      }),
      cache,
    );
  });

  test("should throw ConduitError for ClientCredentials with missing clientId", async () => {
    const subscription = createSubscription({
      auth: WebhookAuth.ClientCredentials,
      clientId: null,
      clientSecret: "client-secret",
      issuer: "https://test.lindorm.io",
    });

    await expect(createConduitWebhookAuthMiddleware(subscription, cache)).rejects.toThrow(
      ConduitError,
    );
  });

  test("should throw ConduitError for ClientCredentials with missing clientSecret", async () => {
    const subscription = createSubscription({
      auth: WebhookAuth.ClientCredentials,
      clientId: "client-id",
      clientSecret: null,
      issuer: "https://test.lindorm.io",
    });

    await expect(createConduitWebhookAuthMiddleware(subscription, cache)).rejects.toThrow(
      ConduitError,
    );
  });

  test("should throw ConduitError for ClientCredentials with missing issuer", async () => {
    const subscription = createSubscription({
      auth: WebhookAuth.ClientCredentials,
      clientId: "client-id",
      clientSecret: "client-secret",
      issuer: null,
    });

    await expect(createConduitWebhookAuthMiddleware(subscription, cache)).rejects.toThrow(
      ConduitError,
    );
  });

  test("should throw ConduitError for unknown auth type", async () => {
    const subscription = createSubscription({
      auth: "unknown" as any,
    });

    await expect(createConduitWebhookAuthMiddleware(subscription, cache)).rejects.toThrow(
      ConduitError,
    );
  });
});
