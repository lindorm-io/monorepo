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

  test("should derive a closed type from the runtime values", () => {
    const fromEnum: ResponseMode = ResponseMode.Query;
    const fromLiteral: ResponseMode = "form_post";
    // @ts-expect-error the type is CLOSED — an unlisted registry entry is not a ResponseMode
    const rejected: ResponseMode = "web_message";
    // a deployment accepting an unlisted mode widens in ITS OWN package, never here
    const widened: ResponseMode | "web_message" = "web_message";

    expect([fromEnum, fromLiteral, rejected, widened]).toMatchSnapshot();
  });
});
