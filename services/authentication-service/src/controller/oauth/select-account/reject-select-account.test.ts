import { rejectSelectAccountController } from "./reject-select-account";

describe("rejectSelectAccountController", () => {
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
    await expect(rejectSelectAccountController(ctx)).resolves.toStrictEqual({ body: "data" });

    expect(ctx.axios.oauthClient.post).toHaveBeenCalledWith(
      "/admin/sessions/select-account/:id/reject",
      expect.any(Object),
    );
  });
});
