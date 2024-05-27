import { Conduit } from "@lindorm/conduit";
import { createMockLogger } from "@lindorm/logger";
import { createHttpConduitMiddleware } from "./http-conduit-middleware";

describe("createHttpConduitMiddleware", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      conduits: {},
      metadata: { correlationId: "correlationId", requestId: "requestId" },
      logger: createMockLogger(),
    };
  });

  test("should resolve", async () => {
    await expect(
      createHttpConduitMiddleware({ alias: "alias", baseUrl: "http://test.io" })(
        ctx,
        jest.fn(),
      ),
    ).resolves.toBeUndefined();

    expect(ctx.conduits.alias).toEqual(expect.any(Conduit));
  });
});