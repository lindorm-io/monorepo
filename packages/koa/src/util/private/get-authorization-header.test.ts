import { getAuthorizationHeader } from "./get-authorization-header";
import { ClientError } from "@lindorm-io/errors";

describe("getAuthorizationHeader", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      get: (): void => {},
    };
  });

  test("should return an object with Basic type and value", () => {
    ctx.get = () => "Basic base64";

    expect(getAuthorizationHeader(ctx)()).toStrictEqual({
      type: "Basic",
      value: "base64",
    });
  });

  test("should return an object with Bearer type and value", () => {
    ctx.get = () => "Bearer jwt.jwt.jwt";

    expect(getAuthorizationHeader(ctx)()).toStrictEqual({
      type: "Bearer",
      value: "jwt.jwt.jwt",
    });
  });

  test("should throw an error when header is unavailable", () => {
    expect(() => getAuthorizationHeader(ctx)()).toThrow(ClientError);
  });

  test("should throw an error when header is too short", () => {
    ctx.get = () => "one";

    expect(() => getAuthorizationHeader(ctx)()).toThrow(ClientError);
  });

  test("should throw an error when header is too long", () => {
    ctx.get = () => "one two three";

    expect(() => getAuthorizationHeader(ctx)()).toThrow(ClientError);
  });

  test("should throw an error when header type is unexpected", () => {
    ctx.get = () => "one two";

    expect(() => getAuthorizationHeader(ctx)()).toThrow(ClientError);
  });
});
