import { composeUrlEncoded } from "./compose-url-encoded.js";
import { describe, expect, test } from "vitest";

describe("composeUrlEncoded", () => {
  test("should append string values verbatim", () => {
    const params = composeUrlEncoded(
      Object.entries({
        grant_type: "authorization_code",
        code: "code",
        redirect_uri: "https://app.lindorm.io/auth/login/callback",
      }),
    );

    expect(Array.from(params.entries())).toMatchSnapshot();
  });

  test("should omit undefined and null values", () => {
    const params = composeUrlEncoded(
      Object.entries({ grant_type: "refresh_token", scope: undefined, code: null }),
    );

    expect(params.toString()).toBe("grant_type=refresh_token");
  });

  // RFC 8693 §2.1 — several audiences are several parameters, not one
  // comma-joined value.
  test("should repeat the parameter for a list of primitives", () => {
    const params = composeUrlEncoded(
      Object.entries({
        audience: ["https://one.lindorm.io", "https://two.lindorm.io"],
        levels: [1, 2],
      }),
    );

    expect(Array.from(params.entries())).toEqual([
      ["audience", "https://one.lindorm.io"],
      ["audience", "https://two.lindorm.io"],
      ["levels", "1"],
      ["levels", "2"],
    ]);
  });

  test("should omit an empty list", () => {
    const params = composeUrlEncoded(Object.entries({ scope: "openid", audience: [] }));

    expect(params.toString()).toBe("scope=openid");
  });

  // RFC 9396 §2 — `authorization_details` is ONE parameter carrying the whole
  // JSON array.
  test("should serialise a list holding objects as one JSON parameter", () => {
    const params = composeUrlEncoded(
      Object.entries({
        authorization_details: [
          { type: "payment_initiation", locations: ["https://api.lindorm.io/payments"] },
        ],
      }),
    );

    expect(Array.from(params.entries())).toEqual([
      [
        "authorization_details",
        '[{"type":"payment_initiation","locations":["https://api.lindorm.io/payments"]}]',
      ],
    ]);
  });

  test("should serialise a nested object as one JSON parameter", () => {
    const params = composeUrlEncoded(
      Object.entries({ claims: { id_token: { acr: { essential: true } } } }),
    );

    expect(params.get("claims")).toBe('{"id_token":{"acr":{"essential":true}}}');
  });

  test("should stringify remaining primitives", () => {
    const params = composeUrlEncoded(
      Object.entries({ max_age: 3600, consent: true, big: 10n }),
    );

    expect(Array.from(params.entries())).toEqual([
      ["max_age", "3600"],
      ["consent", "true"],
      ["big", "10"],
    ]);
  });

  test("should accept FormData entries", () => {
    const form = new FormData();
    form.append("resource", "https://one.lindorm.io");
    form.append("resource", "https://two.lindorm.io");

    const params = composeUrlEncoded(form.entries());

    expect(params.toString()).toBe(
      "resource=https%3A%2F%2Fone.lindorm.io&resource=https%3A%2F%2Ftwo.lindorm.io",
    );
  });
});
