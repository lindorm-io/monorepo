import { getRateLimitBackoffRetrySeconds } from "./get-rate-limit-backoff-retry-seconds";
import { MAXIMUM_RATE_LIMIT_ATTEMPTS } from "../constant";

describe("getRateLimitBackoffRetrySeconds", () => {
  test("should resolve 0", () => {
    expect(getRateLimitBackoffRetrySeconds(MAXIMUM_RATE_LIMIT_ATTEMPTS - 1)).toBe(0);
  });

  test("should resolve 10 minutes", () => {
    expect(getRateLimitBackoffRetrySeconds(MAXIMUM_RATE_LIMIT_ATTEMPTS + 2)).toBe(300);
  });

  test("should resolve 60 minutes", () => {
    expect(getRateLimitBackoffRetrySeconds(MAXIMUM_RATE_LIMIT_ATTEMPTS + 6)).toBe(3600);
  });
});
