import { noopHandler } from "./noop-handler";

describe("noopHandler", () => {
  test("should set body to undefined and status to 204", async () => {
    const ctx: any = { body: "existing", status: 200 };

    await noopHandler(ctx);

    expect(ctx.body).toBeUndefined();
    expect(ctx.status).toBe(204);
  });
});
