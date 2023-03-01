import { SessionStatus } from "@lindorm-io/common-types";
import { createMockLogger } from "@lindorm-io/winston";
import { mockFetchOauthLogoutSession } from "../../../fixtures/axios";
import { randomUUID } from "crypto";
import { redirectLogoutSessionController } from "./redirect-logout-session";
import {
  getOauthLogoutRedirect as _getOauthLogoutRedirect,
  getOauthLogoutSession as _getOauthLogoutSession,
} from "../../../handler";

jest.mock("../../../handler");

const getOauthLogoutRedirect = _getOauthLogoutRedirect as jest.Mock;
const getOauthLogoutSession = _getOauthLogoutSession as jest.Mock;

describe("redirectLogoutSessionController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        session: "e776b26e-8641-4f3f-809b-f717aefaca12",
      },
      logger: createMockLogger(),
    };

    getOauthLogoutRedirect.mockResolvedValue({ redirectTo: "getOauthLogoutRedirect" });
    getOauthLogoutSession.mockResolvedValue(mockFetchOauthLogoutSession());
  });

  test("should resolve", async () => {
    await expect(redirectLogoutSessionController(ctx)).resolves.toStrictEqual({
      redirect: expect.any(URL),
    });
  });

  test("should resolve redirect", async () => {
    getOauthLogoutSession.mockResolvedValue({
      logout: {
        status: SessionStatus.CONFIRMED,

        accessSession: {
          id: randomUUID(),
        },
        browserSession: {
          id: randomUUID(),
          connectedSessions: 3,
        },
        refreshSession: {
          id: null,
        },
      },
    });

    await expect(redirectLogoutSessionController(ctx)).resolves.toStrictEqual({
      redirect: "getOauthLogoutRedirect",
    });
  });
});
