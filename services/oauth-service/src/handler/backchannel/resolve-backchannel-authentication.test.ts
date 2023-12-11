import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
  Scope,
  SessionStatus,
} from "@lindorm-io/common-enums";
import { ServerError } from "@lindorm-io/errors";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import { createMockRedisRepository } from "@lindorm-io/redis";
import { createMockLogger } from "@lindorm-io/winston";
import MockDate from "mockdate";
import { BackchannelSession, Client } from "../../entity";
import {
  createTestBackchannelSession,
  createTestClient,
  createTestClientSession,
} from "../../fixtures/entity";
import { handleBackchannelPing as _handleBackchannelPing } from "./handle-backchannel-ping";
import { handleBackchannelPush as _handleBackchannelPush } from "./handle-backchannel-push";
import { resolveBackchannelAuthentication } from "./resolve-backchannel-authentication";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("./handle-backchannel-ping");
jest.mock("./handle-backchannel-push");

const handleBackchannelPing = _handleBackchannelPing as jest.Mock;
const handleBackchannelPush = _handleBackchannelPush as jest.Mock;

describe("resolveBackchannelAuthentication", () => {
  let ctx: any;
  let client: Client;
  let backchannelSession: BackchannelSession;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
      mongo: {
        clientSessionRepository: createMockMongoRepository(createTestClientSession),
      },
      redis: {
        backchannelSessionCache: createMockRedisRepository(createTestBackchannelSession),
      },
    };

    client = createTestClient({
      id: "93a3e439-12be-582d-ae8f-5cb7e1ab3ebd",
      tenantId: "8039186b-9006-4f35-a764-cabdf1471290",
    });

    backchannelSession = createTestBackchannelSession({
      clientId: "93a3e439-12be-582d-ae8f-5cb7e1ab3ebd",
      confirmedConsent: {
        audiences: ["85c5c825-a762-518c-9eec-4ab2a7355601"],
        scopes: [Scope.OPENID, Scope.OFFLINE_ACCESS],
      },
      confirmedLogin: {
        factors: [AuthenticationFactor.ONE_FACTOR],
        identityId: "69d76427-1e6c-5915-b4c0-08fd6bb0b14f",
        latestAuthentication: new Date(),
        levelOfAssurance: 3,
        metadata: {},
        methods: [AuthenticationMethod.PASSWORD],
        remember: true,
        singleSignOn: true,
        strategies: [AuthenticationStrategy.PASSWORD_BROWSER_LINK],
      },
      status: {
        consent: SessionStatus.CONFIRMED,
        login: SessionStatus.CONFIRMED,
      },
    });

    handleBackchannelPing.mockResolvedValue(undefined);
    handleBackchannelPush.mockResolvedValue(undefined);
  });

  test("should return on pending consent status", async () => {
    backchannelSession.status.consent = SessionStatus.PENDING;

    await expect(
      resolveBackchannelAuthentication(ctx, client, backchannelSession),
    ).resolves.toBeUndefined();

    expect(ctx.mongo.clientSessionRepository.create).not.toHaveBeenCalled();
  });

  test("should return on pending login status", async () => {
    backchannelSession.status.login = SessionStatus.PENDING;

    await expect(
      resolveBackchannelAuthentication(ctx, client, backchannelSession),
    ).resolves.toBeUndefined();

    expect(ctx.mongo.clientSessionRepository.create).not.toHaveBeenCalled();
  });

  test("should resolve", async () => {
    await expect(
      resolveBackchannelAuthentication(ctx, client, backchannelSession),
    ).resolves.toBeUndefined();

    expect(ctx.mongo.clientSessionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        audiences: ["85c5c825-a762-518c-9eec-4ab2a7355601"],
        authorizationGrant: "urn:openid:params:grant-type:ciba",
        browserSessionId: null,
        clientId: "93a3e439-12be-582d-ae8f-5cb7e1ab3ebd",
        code: null,
        expires: new Date("2021-01-01T09:00:00.000Z"),
        factors: ["urn:lindorm:auth:acr:1fa"],
        identityId: "69d76427-1e6c-5915-b4c0-08fd6bb0b14f",
        latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        levelOfAssurance: 3,
        metadata: {},
        methods: ["urn:lindorm:auth:method:password"],
        nonce: expect.any(String),
        revision: 0,
        scopes: ["openid", "offline_access"],
        strategies: ["urn:lindorm:auth:strategy:password-browser-link"],
        tenantId: "8039186b-9006-4f35-a764-cabdf1471290",
        type: "refresh",
        version: 0,
      }),
    );

    expect(ctx.redis.backchannelSessionCache.update).toHaveBeenCalled();
  });

  test("should throw on invalid consent data", async () => {
    backchannelSession.confirmedConsent.audiences = [];

    await expect(resolveBackchannelAuthentication(ctx, client, backchannelSession)).rejects.toThrow(
      ServerError,
    );
  });

  test("should throw on invalid login data", async () => {
    backchannelSession.confirmedLogin.identityId = null;

    await expect(resolveBackchannelAuthentication(ctx, client, backchannelSession)).rejects.toThrow(
      ServerError,
    );
  });
});
