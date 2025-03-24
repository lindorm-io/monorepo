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
    };
  });

  test("should resolve", async () => {
    await expect(
      useValidation("jwt", { audience: "value" })(ctx, jest.fn()),
    ).resolves.toBeUndefined();
  });
});
