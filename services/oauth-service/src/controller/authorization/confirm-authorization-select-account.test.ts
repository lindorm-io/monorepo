import { createMockLogger } from "@lindorm-io/core-logger";
import { ClientError } from "@lindorm-io/errors";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import { createMockRedisRepository } from "@lindorm-io/redis";
import { randomUUID } from "crypto";
import MockDate from "mockdate";
import {
  createTestAuthorizationSession,
  createTestBrowserSession,
  createTestClient,
  createTestClientSession,
} from "../../fixtures/entity";
import {
  isConsentRequired as _isConsentRequired,
  isLoginRequired as _isLoginRequired,
  isSsoAvailable as _isSsoAvailable,
  tryFindClientSession as _tryFindClientSession,
} from "../../handler";
import { createAuthorizationVerifyUri as _createAuthorizationVerifyUri } from "../../util";
import { confirmAuthorizationSelectAccountController } from "./confirm-authorization-select-account";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../handler");
jest.mock("../../util");

const tryFindClientSession = _tryFindClientSession as jest.Mock;
const createAuthorizationVerifyUri = _createAuthorizationVerifyUri as jest.Mock;
const isConsentRequired = _isConsentRequired as jest.Mock;
const isLoginRequired = _isLoginRequired as jest.Mock;
const isSsoAvailable = _isSsoAvailable as jest.Mock;

describe("confirmAuthorizationSelectAccountController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      redis: {
        authorizationSessionCache: createMockRedisRepository(createTestAuthorizationSession),
      },
      data: {
        selectNew: false,
        selectExisting: "abdd7aba-5c2d-474d-a965-4eb9a261a929",
      },
      entity: {
        authorizationSession: createTestAuthorizationSession({
          browserSessionId: null,
          clientSessionId: null,
          requestedSelectAccount: {
            browserSessions: [
              {
                browserSessionId: "abdd7aba-5c2d-474d-a965-4eb9a261a929",
                identityId: randomUUID(),
              },
              { browserSessionId: randomUUID(), identityId: randomUUID() },
              { browserSessionId: randomUUID(), identityId: randomUUID() },
            ],
          },
        }),
        client: createTestClient(),
      },
      jwt: {
        verify: jest.fn().mockReturnValue("idToken"),
      },
      logger: createMockLogger(),
      mongo: {
        browserSessionRepository: createMockMongoRepository(createTestBrowserSession),
      },
    };

    tryFindClientSession.mockResolvedValue(
      createTestClientSession({ id: "250cdbef-41d1-4b10-8e57-71698ff98519" }),
    );
    createAuthorizationVerifyUri.mockReturnValue("createAuthorizationVerifyUri");
    isConsentRequired.mockReturnValue(true);
    isLoginRequired.mockReturnValue(true);
    isSsoAvailable.mockReturnValue(false);
  });

  test("should resolve existing session", async () => {
    await expect(confirmAuthorizationSelectAccountController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "createAuthorizationVerifyUri" },
    });

    expect(ctx.redis.authorizationSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        browserSessionId: "abdd7aba-5c2d-474d-a965-4eb9a261a929",
        clientSessionId: "250cdbef-41d1-4b10-8e57-71698ff98519",
        status: {
          consent: "pending",
          login: "pending",
          selectAccount: "confirmed",
        },
      }),
    );
  });

  test("should resolve new session", async () => {
    ctx.data.selectNew = true;

    await expect(confirmAuthorizationSelectAccountController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "createAuthorizationVerifyUri" },
    });

    expect(ctx.redis.authorizationSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        browserSessionId: null,
        clientSessionId: null,
        status: {
          consent: "pending",
          login: "pending",
          selectAccount: "confirmed",
        },
      }),
    );
  });

  test("should throw on invalid session", async () => {
    ctx.data.selectExisting = "c7a03f2f-f255-4ee4-a358-43ab0d792d6b";

    await expect(confirmAuthorizationSelectAccountController(ctx)).rejects.toThrow(ClientError);
  });
});
