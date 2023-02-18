import MockDate from "mockdate";
import { confirmSelectAccountController } from "./confirm-select-account";
import { createMockCache } from "@lindorm-io/redis";
import { createMockLogger } from "@lindorm-io/core-logger";
import { createMockRepository } from "@lindorm-io/mongo";
import {
  tryFindAccessSession as _tryFindAccessSession,
  tryFindRefreshSession as _tryFindRefreshSession,
} from "../../handler";
import {
  createAuthorizationVerifyUri as _createAuthorizationVerifyUri,
  isConsentRequired as _isConsentRequired,
  isLoginRequired as _isLoginRequired,
} from "../../util";
import {
  createTestAccessSession,
  createTestAuthorizationSession,
  createTestBrowserSession,
  createTestClient,
  createTestRefreshSession,
} from "../../fixtures/entity";
import { randomUUID } from "crypto";
import { ClientError } from "@lindorm-io/errors";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../handler");
jest.mock("../../util");

const tryFindAccessSession = _tryFindAccessSession as jest.Mock;
const tryFindRefreshSession = _tryFindRefreshSession as jest.Mock;
const createAuthorizationVerifyUri = _createAuthorizationVerifyUri as jest.Mock;
const isConsentRequired = _isConsentRequired as jest.Mock;
const isLoginRequired = _isLoginRequired as jest.Mock;

describe("confirmSelectAccountController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        authorizationSessionCache: createMockCache(createTestAuthorizationSession),
      },
      data: {
        selectNew: false,
        selectExisting: "abdd7aba-5c2d-474d-a965-4eb9a261a929",
      },
      entity: {
        authorizationSession: createTestAuthorizationSession({
          accessSessionId: null,
          browserSessionId: null,
          refreshSessionId: null,
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
        verify: jest.fn().mockImplementation(() => "idToken"),
      },
      logger: createMockLogger(),
      repository: {
        browserSessionRepository: createMockRepository(createTestBrowserSession),
      },
    };

    tryFindAccessSession.mockResolvedValue(
      createTestAccessSession({ id: "2b8cca54-11ef-45f8-9c40-7afa60853fee" }),
    );
    tryFindRefreshSession.mockResolvedValue(
      createTestRefreshSession({ id: "250cdbef-41d1-4b10-8e57-71698ff98519" }),
    );
    createAuthorizationVerifyUri.mockImplementation(() => "createAuthorizationVerifyUri");
    isConsentRequired.mockImplementation(() => true);
    isLoginRequired.mockImplementation(() => true);
  });

  test("should resolve existing session", async () => {
    await expect(confirmSelectAccountController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "createAuthorizationVerifyUri" },
    });

    expect(ctx.cache.authorizationSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        accessSessionId: "2b8cca54-11ef-45f8-9c40-7afa60853fee",
        browserSessionId: "abdd7aba-5c2d-474d-a965-4eb9a261a929",
        refreshSessionId: "250cdbef-41d1-4b10-8e57-71698ff98519",
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

    await expect(confirmSelectAccountController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "createAuthorizationVerifyUri" },
    });

    expect(ctx.cache.authorizationSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        accessSessionId: null,
        browserSessionId: null,
        refreshSessionId: null,
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

    await expect(confirmSelectAccountController(ctx)).rejects.toThrow(ClientError);
  });
});
