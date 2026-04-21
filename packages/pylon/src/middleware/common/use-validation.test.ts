import { JwtKit } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { useValidation } from "./use-validation.js";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";

describe("useValidation", () => {
  let ctx: any;
  let next: Mock;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
      state: {
        tokens: {
          jwt: { audience: "test-audience" },
        },
      },
    };
    next = vi.fn();
  });

  test("should resolve when validation passes", async () => {
    vi.spyOn(JwtKit, "validate").mockImplementation(() => undefined);

    const middleware = useValidation("jwt", { audience: "test-audience" });

    await expect(middleware(ctx, next)).resolves.toBeUndefined();

    expect(next).toHaveBeenCalledTimes(1);

    vi.restoreAllMocks();
  });

  test("should throw ClientError when token not found at path", async () => {
    const middleware = useValidation("missing", { audience: "test-audience" });

    await expect(middleware(ctx, next)).rejects.toThrow(ClientError);

    try {
      await middleware(ctx, next);
    } catch (err: any) {
      expect(err.status).toBe(403);
      expect(err.message).toMatchSnapshot();
    }
  });

  test("should throw ClientError 403 when validation fails", async () => {
    vi.spyOn(JwtKit, "validate").mockImplementation(() => {
      throw new Error("audience mismatch");
    });

    const middleware = useValidation("jwt", { audience: "wrong-audience" });

    await expect(middleware(ctx, next)).rejects.toThrow(ClientError);

    try {
      await middleware(ctx, next);
    } catch (err: any) {
      expect(err.status).toBe(403);
      expect(err.message).toMatchSnapshot();
    }

    vi.restoreAllMocks();
  });
});
