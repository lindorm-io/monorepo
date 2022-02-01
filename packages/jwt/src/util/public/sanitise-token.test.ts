import { sanitiseToken } from "./sanitise-token";
import { sign } from "jsonwebtoken";

describe("sanitiseToken", () => {
  let token: string;
  let split: Array<string>;

  beforeAll(() => {
    token = sign({ payload: true }, "secret");
    split = token.split(".");
  });

  test("should sanitise by removing encryption", () => {
    expect(sanitiseToken(token)).toBe(`${split[0]}.${split[1]}`);
  });

  test("should not try to sanitise if the input is not a token", () => {
    expect(sanitiseToken("mock-string")).toBe("mock-string");
  });

  test("should not try to sanitise if there is no input", () => {
    const _token: any = null;
    expect(sanitiseToken(_token)).toBe(null);
  });
});
