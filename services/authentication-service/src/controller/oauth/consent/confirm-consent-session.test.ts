import { confirmConsentSessionController } from "./confirm-consent-session";

describe("confirmConsentSessionController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      axios: {
        oauthClient: {
          post: jest.fn().mockResolvedValue({ data: "data" }),
        },
      },
      data: {
        id: "id",
        audiences: "audiences",
        scopes: "scopes",
      },
    };
  });

  test("should resolve", async () => {
    await expect(confirmConsentSessionController(ctx)).resolves.toStrictEqual({ body: "data" });

    expect(ctx.axios.oauthClient.post).toHaveBeenCalledWith(
      "/internal/sessions/consent/:id/confirm",
      expect.any(Object),
    );
  });
});
