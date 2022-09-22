import { confirmLogoutSessionController } from "./confirm-logout-session";

describe("confirmLogoutSessionController", () => {
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
    await expect(confirmLogoutSessionController(ctx)).resolves.toStrictEqual({ body: "data" });

    expect(ctx.axios.oauthClient.post).toHaveBeenCalledWith(
      "/internal/sessions/logout/:id/confirm",
      expect.any(Object),
    );
  });
});
