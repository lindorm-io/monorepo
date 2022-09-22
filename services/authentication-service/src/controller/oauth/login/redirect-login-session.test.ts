import { redirectLoginSessionController } from "./redirect-login-session";
import { fetchOauthLoginData as _fetchOauthLoginInfo } from "../../../handler";
import { createMockLogger } from "@lindorm-io/winston";

jest.mock("../../../handler");

const fetchOauthLoginInfo = _fetchOauthLoginInfo as jest.Mock;

describe("redirectLoginSessionController", () => {
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
      jwt: {
        verify: jest.fn().mockImplementation(() => ({
          authContextClass: "authContextClass",
          authMethodsReference: "authMethodsReference",
          subject: "subject",
          levelOfAssurance: "levelOfAssurance",
          claims: {
            remember: "remember",
          },
        })),
      },
      logger: createMockLogger(),
    };

    fetchOauthLoginInfo.mockResolvedValue({
      loginStatus: "pending",
      authorizationSession: {
        authToken: null,
      },
    });
  });

  test("should resolve", async () => {
    await expect(redirectLoginSessionController(ctx)).resolves.toStrictEqual({
      redirect: expect.any(URL),
    });
  });

  test("should resolve verify", async () => {
    fetchOauthLoginInfo.mockResolvedValue({
      loginStatus: "unexpected",
      authorizationSession: {
        authToken: null,
      },
    });

    await expect(redirectLoginSessionController(ctx)).resolves.toStrictEqual({
      redirect: "redirectVerify",
    });
  });

  test("should resolve confirm", async () => {
    fetchOauthLoginInfo.mockResolvedValue({
      loginStatus: "pending",
      authorizationSession: {
        authToken: "jwt.jwt.jwt",
      },
    });

    await expect(redirectLoginSessionController(ctx)).resolves.toStrictEqual({
      redirect: "redirectConfirm",
    });

    expect(ctx.axios.oauthClient.post).toHaveBeenCalledWith(
      "/internal/sessions/login/:id/confirm",
      {
        params: { id: "sessionId" },
        body: {
          acrValues: "authContextClass",
          amrValues: "authMethodsReference",
          identityId: "subject",
          levelOfAssurance: "levelOfAssurance",
          remember: "remember",
        },
        middleware: expect.any(Array),
      },
    );
  });
});
