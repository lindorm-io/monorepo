import { createMockLogger } from "@lindorm/logger";
import { useValidation } from "./use-validation";

describe("useValidation", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
      state: {
        tokens: { jwt: { audience: "value" } },
      },
      metric: jest.fn().mockReturnValue({ end: jest.fn() }),
    };
  });

  test("should resolve", async () => {
    await expect(
      useValidation("jwt", { audience: "value" })(ctx, jest.fn()),
    ).resolves.toBeUndefined();
  });
});
