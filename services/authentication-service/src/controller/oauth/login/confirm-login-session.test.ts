import { confirmLoginSessionController } from "./confirm-login-session";

describe("confirmLoginSessionController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      axios: {
        oauthClient: {
          post: jest.fn().mockResolvedValue({ data: "data" }),
        },
      },
      token: {
        authenticationConfirmationToken: {
          authContextClass: "authContextClass",
          authMethodsReference: "authMethodsReference",
          subject: "subject",
          levelOfAssurance: "levelOfAssurance",
          claims: {
            remember: "remember",
          },
          sessionId: "sessionId",
        },
      },
    };
  });

  test("should resolve", async () => {
    await expect(confirmLoginSessionController(ctx)).resolves.toStrictEqual({ body: "data" });

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
