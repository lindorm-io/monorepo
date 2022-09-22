import { confirmElevationSessionController } from "./confirm-elevation-session";

describe("confirmElevationSessionController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      axios: {
        oauthClient: {
          post: jest.fn(),
        },
      },
      token: {
        authenticationConfirmationToken: {
          authContextClass: "authContextClass",
          authMethodsReference: "authMethodsReference",
          subject: "subject",
          levelOfAssurance: "levelOfAssurance",
          sessionId: "sessionId",
        },
      },
    };
  });

  test("should resolve", async () => {
    await expect(confirmElevationSessionController(ctx)).resolves.toBeUndefined();

    expect(ctx.axios.oauthClient.post).toHaveBeenCalledWith(
      "/internal/sessions/elevation/:id/confirm",
      {
        params: { id: "sessionId" },
        body: {
          acrValues: "authContextClass",
          amrValues: "authMethodsReference",
          identityId: "subject",
          levelOfAssurance: "levelOfAssurance",
        },
        middleware: expect.any(Array),
      },
    );
  });
});
