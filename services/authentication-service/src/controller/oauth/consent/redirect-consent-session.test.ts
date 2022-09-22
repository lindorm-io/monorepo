import { redirectConsentSessionController } from "./redirect-consent-session";
import { fetchOauthConsentData as _fetchOauthConsentInfo } from "../../../handler";
import { createMockLogger } from "@lindorm-io/winston";

jest.mock("../../../handler");

const fetchOauthConsentInfo = _fetchOauthConsentInfo as jest.Mock;

describe("redirectConsentSessionController", () => {
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

    fetchOauthConsentInfo.mockResolvedValue({
      consentStatus: "pending",
      client: {
        type: "public",
      },
      requested: {
        audiences: ["audience"],
        scopes: ["scope"],
      },
    });
  });

  test("should resolve", async () => {
    await expect(redirectConsentSessionController(ctx)).resolves.toStrictEqual({
      redirect: expect.any(URL),
    });
  });

  test("should resolve verify", async () => {
    fetchOauthConsentInfo.mockResolvedValue({
      consentStatus: "unexpected",
      client: {
        type: "public",
      },
      requested: {
        audiences: ["audience"],
        scopes: ["scope"],
      },
    });

    await expect(redirectConsentSessionController(ctx)).resolves.toStrictEqual({
      redirect: "redirectVerify",
    });
  });

  test("should resolve confirm", async () => {
    fetchOauthConsentInfo.mockResolvedValue({
      consentStatus: "pending",
      client: {
        type: "confidential",
      },
      requested: {
        audiences: ["audience"],
        scopes: ["scope"],
      },
    });

    await expect(redirectConsentSessionController(ctx)).resolves.toStrictEqual({
      redirect: "redirectConfirm",
    });
  });
});
