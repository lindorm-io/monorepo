import { Conduit } from "@lindorm/conduit";
import { createMockLogger } from "@lindorm/logger";
import { createSocketConduitMiddleware } from "./socket-conduit-middleware";

describe("createSocketConduitMiddleware", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      conduits: {},
      logger: createMockLogger(),
    };
  });

  test("should resolve", async () => {
    await expect(
      createSocketConduitMiddleware({ alias: "alias", baseUrl: "http://test.io" })(
        ctx,
        jest.fn(),
      ),
    ).resolves.toBeUndefined();

    expect(ctx.conduits.alias).toEqual(expect.any(Conduit));
  });
});
