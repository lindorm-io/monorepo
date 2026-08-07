import { ClientError, ServerError } from "@lindorm/errors";
import { describe, expect, test } from "vitest";
import { resolveErrorStatus } from "./resolve-error-status.js";

describe("resolveErrorStatus", () => {
  test("should read a lindorm error's status", () => {
    expect(
      resolveErrorStatus(
        new ClientError("nope", { status: ClientError.Status.Forbidden }),
      ),
    ).toBe(403);
  });

  test("should read statusCode when there is no status", () => {
    expect(resolveErrorStatus({ statusCode: 429 })).toBe(429);
  });

  test("should prefer status over statusCode", () => {
    expect(resolveErrorStatus({ status: 401, statusCode: 500 })).toBe(401);
  });

  test("should fall back to 500 for an error carrying neither", () => {
    expect(resolveErrorStatus(new Error("kaboom"))).toBe(
      ServerError.Status.InternalServerError,
    );
  });

  test("should fall back to 500 for a nullish input", () => {
    expect(resolveErrorStatus(undefined)).toBe(500);
    expect(resolveErrorStatus(null)).toBe(500);
  });
});
