import { rejectElevationSessionController } from "./reject-elevation-session";

describe("rejectElevationSessionController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      axios: {
        oauthClient: {
          post: jest.fn(),
        },
      },
      data: {
        id: "id",
      },
    };
  });

  test("should resolve", async () => {
    await expect(rejectElevationSessionController(ctx)).resolves.toBeUndefined();

    expect(ctx.axios.oauthClient.post).toHaveBeenCalledWith(
      "/internal/sessions/elevation/:id/reject",
      expect.any(Object),
    );
  });
});
