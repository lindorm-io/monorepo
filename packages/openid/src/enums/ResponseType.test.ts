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

  test("should derive a closed type from the runtime values", () => {
    const fromEnum: ResponseType = ResponseType.Code;
    const fromLiteral: ResponseType = "id_token";
    // @ts-expect-error the type is CLOSED — an RFC 6749 §8.4 extension type is not a ResponseType
    const rejected: ResponseType = "urn:example:response-type";
    // a deployment accepting an extension type widens in ITS OWN package, never here
    const widened: ResponseType | "urn:example:response-type" =
      "urn:example:response-type";

    expect([fromEnum, fromLiteral, rejected, widened]).toMatchSnapshot();
  });
});
