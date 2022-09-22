import { redirectLogoutSessionController } from "./redirect-logout-session";
import { fetchOauthLogoutData as _fetchOauthLogoutInfo } from "../../../handler";
import { createMockLogger } from "@lindorm-io/winston";

jest.mock("../../../handler");

const fetchOauthLogoutInfo = _fetchOauthLogoutInfo as jest.Mock;

describe("redirectLogoutSessionController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      axios: {
        oauthClient: {
          get: jest.fn().mockResolvedValue({ data: { redirectTo: "redirectVerify" } }),
          post: jest.fn().mockResolvedValue({ data: { redirectTo: "redirectConfirm" } }),
        },
      },
      data: {
        sessionId: "sessionId",
      },
      logger: createMockLogger(),
    };

    fetchOauthLogoutInfo.mockResolvedValue({
      logoutStatus: "pending",
      client: {
        type: "public",
      },
    });
  });

  test("should resolve", async () => {
    await expect(redirectLogoutSessionController(ctx)).resolves.toStrictEqual({
      redirect: expect.any(URL),
    });
  });

  test("should resolve verify", async () => {
    fetchOauthLogoutInfo.mockResolvedValue({
      logoutStatus: "unexpected",
      client: {
        type: "public",
      },
      requested: {
        audiences: ["audience"],
        scopes: ["scope"],
      },
    });

    await expect(redirectLogoutSessionController(ctx)).resolves.toStrictEqual({
      redirect: "redirectVerify",
    });
  });

  test("should resolve confirm", async () => {
    fetchOauthLogoutInfo.mockResolvedValue({
      logoutStatus: "pending",
      client: {
        type: "confidential",
      },
    });

    await expect(redirectLogoutSessionController(ctx)).resolves.toStrictEqual({
      redirect: "redirectConfirm",
    });
  });
});
