import { ClientError } from "@lindorm/errors";
import { assertAllowedOrigin } from "./assert-allowed-origin";

describe("assertAllowedOrigin", () => {
  test("should throw Forbidden when origin is missing", () => {
    expect(() => assertAllowedOrigin(undefined, ["https://app.example.com"])).toThrow(
      ClientError,
    );
    try {
      assertAllowedOrigin(undefined, ["https://app.example.com"]);
    } catch (err: any) {
      expect(err.status).toBe(ClientError.Status.Forbidden);
      expect(err.code).toBe("origin_missing");
    }
  });

  test("should throw Forbidden when origin is not allowed", () => {
    try {
      assertAllowedOrigin("https://evil.example.com", ["https://app.example.com"]);
      fail("should have thrown");
    } catch (err: any) {
      expect(err).toBeInstanceOf(ClientError);
      expect(err.status).toBe(ClientError.Status.Forbidden);
      expect(err.code).toBe("origin_not_allowed");
    }
  });

  test("should not throw when origin is allowed", () => {
    expect(() =>
      assertAllowedOrigin("https://app.example.com", ["https://app.example.com"]),
    ).not.toThrow();
  });
});
