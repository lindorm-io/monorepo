import { sanitiseToken } from "./sanitise-token";

describe("sanitiseToken", () => {
  let token: string;

  beforeAll(() => {
    token = "mock-header.mock-payload.mock-signature";
  });

  test("should sanitise by removing encryption", () => {
    expect(sanitiseToken(token)).toBe("mock-header.mock-payload");
  });

  test("should not try to sanitise if the input is not a token", () => {
    expect(sanitiseToken("mock-string")).toBe("mock-string");
  });

  test("should not try to sanitise if there is no input", () => {
    const _token: any = null;
    expect(sanitiseToken(_token)).toBe(null);
  });
});
