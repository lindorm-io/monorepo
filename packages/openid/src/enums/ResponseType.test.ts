import { describe, expect, test } from "vitest";
import { ResponseType } from "./ResponseType.js";

describe("ResponseType", () => {
  test("should match snapshot", () => {
    expect(ResponseType).toMatchSnapshot();
  });

  test("should space-delimit the multi-value response types in spec order", () => {
    expect(ResponseType.CodeIdToken).toBe("code id_token");
    expect(ResponseType.CodeToken).toBe("code token");
    expect(ResponseType.IdTokenToken).toBe("id_token token");
    expect(ResponseType.CodeIdTokenToken).toBe("code id_token token");
  });

  test("should derive the type from the runtime values", () => {
    const fromEnum: ResponseType = ResponseType.Code;
    const fromLiteral: ResponseType = "id_token";
    const extension: ResponseType = "urn:example:response-type";

    expect([fromEnum, fromLiteral, extension]).toMatchSnapshot();
  });
});
