import { rejectConsentSessionController } from "./reject-consent-session";

describe("rejectConsentSessionController", () => {
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
    await expect(rejectConsentSessionController(ctx)).resolves.toStrictEqual({ body: "data" });

    expect(ctx.axios.oauthClient.post).toHaveBeenCalledWith(
      "/admin/sessions/consent/:id/reject",
      expect.any(Object),
    );
  });
});
