import { rejectLogoutSessionController } from "./reject-logout-session";

describe("rejectLogoutSessionController", () => {
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
      },
    };
  });

  test("should resolve", async () => {
    await expect(rejectLogoutSessionController(ctx)).resolves.toStrictEqual({ body: "data" });

    expect(ctx.axios.oauthClient.post).toHaveBeenCalledWith(
      "/internal/sessions/logout/:id/reject",
      expect.any(Object),
    );
  });
});
