import { createMockAegis } from "@lindorm/aegis/mocks/vitest";
import { ClientError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { useValidation } from "./use-validation.js";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";

describe("useValidation", () => {
  let ctx: any;
  let next: Mock;

  beforeEach(() => {
    ctx = {
      // The mock's `assert` arm runs the real claim check, so every verdict
      // below is the check's own.
      aegis: createMockAegis(),
      logger: createMockLogger(),
      state: {
        tokens: {
          jwt: { claims: { audience: ["test-audience"] } },
        },
      },
    };
    next = vi.fn();
  });

  test("should resolve when validation passes", async () => {
    const middleware = useValidation("jwt", { audience: "test-audience" });

    await expect(middleware(ctx, next)).resolves.toBeUndefined();

    expect(next).toHaveBeenCalledTimes(1);
  });

  test("should throw ClientError when token not found at path", async () => {
    const middleware = useValidation("missing", { audience: "test-audience" });

    await expect(middleware(ctx, next)).rejects.toThrow(ClientError);

    try {
      await middleware(ctx, next);
    } catch (err: any) {
      expect(err.status).toBe(401);
      expect(err.message).toMatchSnapshot();
    }
  });

  test("should throw ClientError 403 when validation fails", async () => {
    const middleware = useValidation("jwt", { audience: "wrong-audience" });

    await expect(middleware(ctx, next)).rejects.toThrow(ClientError);

    try {
      await middleware(ctx, next);
    } catch (err: any) {
      expect(err.status).toBe(403);
      expect(err.message).toMatchSnapshot();
      // The catch-all turns ANY error into this 403, so the 403 alone proves
      // nothing; the details are the claim check's own refusal.
      expect(err.details).toBe("Invalid token");
    }
  });
});
