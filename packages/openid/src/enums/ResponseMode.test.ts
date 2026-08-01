import { describe, expect, test } from "vitest";
import { ResponseMode } from "./ResponseMode.js";

describe("ResponseMode", () => {
  test("should match snapshot", () => {
    expect(ResponseMode).toMatchSnapshot();
  });

  test("should suffix every JARM variant with .jwt", () => {
    expect(ResponseMode.FormPostJwt).toBe("form_post.jwt");
    expect(ResponseMode.FragmentJwt).toBe("fragment.jwt");
    expect(ResponseMode.QueryJwt).toBe("query.jwt");
    expect(ResponseMode.Jwt).toBe("jwt");
  });

  test("should derive the type from the runtime values", () => {
    const fromEnum: ResponseMode = ResponseMode.Query;
    const fromLiteral: ResponseMode = "form_post";
    const extension: ResponseMode = "web_message";

    expect([fromEnum, fromLiteral, extension]).toMatchSnapshot();
  });
});
