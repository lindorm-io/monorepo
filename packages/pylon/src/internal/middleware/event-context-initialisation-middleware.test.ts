import { Aegis } from "@lindorm/aegis";
import { createMockAmphora } from "@lindorm/amphora";
import { Conduit } from "@lindorm/conduit";
import { createMockLogger } from "@lindorm/logger";
import { createEventContextInitialisationMiddleware } from "./event-context-initialisation-middleware";

describe("createEventContextInitialisationMiddleware", () => {
  let ctx: any;
  let options: any;

  beforeEach(() => {
    ctx = {
      metadata: {
        correlationId: "8b39eafc-7e31-501b-ab7b-58514b14856a",
        requestId: "aa9a627d-8296-598c-9589-4ec91d27d056",
        responseId: "ee576e4a-c30c-5138-bfa8-51ca832bdaec",
      },
      socket: {
        id: "009aecca-3bc0-500f-8e67-6dae90188c7d",
      },
    };

    options = {
      amphora: createMockAmphora(),
      issuer: "issuer",
      logger: createMockLogger(),
    };
  });

  test("should initialise context", async () => {
    await expect(
      createEventContextInitialisationMiddleware(options)(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.logger).toEqual(expect.any(Object));
    expect(ctx.amphora).toEqual(options.amphora);
    expect(ctx.aegis).toEqual(expect.any(Aegis));
    expect(ctx.conduits.conduit).toEqual(expect.any(Conduit));
  });
});
