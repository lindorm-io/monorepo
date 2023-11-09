import { SessionStatus } from "@lindorm-io/common-enums";
import { createMockLogger } from "@lindorm-io/winston";
import { mockFetchOauthAuthorizationSession } from "../../../fixtures/axios";
import {
  getOauthAuthorizationRedirect as _getOauthAuthorizationRedirect,
  getOauthAuthorizationSession as _getOauthAuthorizationSession,
} from "../../../handler";
import { redirectSelectAccountController } from "./redirect-select-account";

jest.mock("../../../handler");

const getOauthAuthorizationRedirect = _getOauthAuthorizationRedirect as jest.Mock;
const getOauthAuthorizationSession = _getOauthAuthorizationSession as jest.Mock;

describe("redirectSelectAccountController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        session: "f771592d-e4f6-418f-8faa-f5ea757062aa",
      },
      logger: createMockLogger(),
    };

    getOauthAuthorizationRedirect.mockResolvedValue({
      redirectTo: "getOauthAuthorizationRedirect",
    });
    getOauthAuthorizationSession.mockResolvedValue(mockFetchOauthAuthorizationSession());
  });

  test("should resolve url", async () => {
    await expect(redirectSelectAccountController(ctx)).resolves.toStrictEqual({
      redirect: expect.any(URL),
    });
  });

  test("should resolve redirect", async () => {
    getOauthAuthorizationSession.mockResolvedValue(
      mockFetchOauthAuthorizationSession({
        selectAccount: {
          isRequired: true,
          status: SessionStatus.CONFIRMED,

          sessions: [
            {
              identityId: "ee8c8afd-2a61-4e27-896c-9beda5489578",
              selectId: "89d01578-8cfe-42a2-adb2-a3a023c39c02",
            },
            {
              identityId: "3873393a-22f7-4ff4-bacd-c54ec48bed56",
              selectId: "402876df-dcb8-4e35-b42b-1f2e3b3815a0",
            },
          ],
        },
      }),
    );

    await expect(redirectSelectAccountController(ctx)).resolves.toStrictEqual({
      redirect: "getOauthAuthorizationRedirect",
    });
  });
});
