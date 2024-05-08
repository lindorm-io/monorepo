import { sanitiseAuthorization } from "./sanitise-authorization";

describe("sanitiseAuthorization", () => {
  let authorization: string;

  beforeAll(() => {
    authorization = "Bearer mock-header.mock-payload.mock-signature";
  });

  test("should sanitise Bearer by removing encryption", () => {
    expect(sanitiseAuthorization(authorization)).toBe("Bearer mock-header.mock-payload");
  });

  test("should sanitise Basic by removing everything", () => {
    expect(sanitiseAuthorization("Basic secret")).toBe("Basic [Filtered]");
  });

  test("should not try to sanitise if the input is not a token", () => {
    expect(sanitiseAuthorization("mock-string")).toBe("[Filtered]");
  });

  test("should not try to sanitise if there is no input", () => {
    const _token: any = null;
    expect(sanitiseAuthorization(_token)).toBe(null);
  });
});
