import { ClientError } from "@lindorm/errors";
import { describe, expect, test } from "vitest";
import type { PylonResolvedAccess } from "../../../types/index.js";
import { assertResolvedAccess } from "./assert-resolved-access.js";

const access = (
  provenance: PylonResolvedAccess["provenance"],
  claims: Record<string, unknown> = {},
): PylonResolvedAccess =>
  ({ provenance, custom: {}, token: "the-token", claims }) as PylonResolvedAccess;

describe("assertResolvedAccess", () => {
  const ISSUER = "https://idp.test.lindorm.io";

  describe("issuer — the optional-bound idiom", () => {
    test("accepts a matching issuer", () => {
      expect(() =>
        assertResolvedAccess(access("verified", { issuer: ISSUER }), {
          issuer: ISSUER,
          matchers: {},
        }),
      ).not.toThrow();
    });

    test("refuses a different issuer", () => {
      expect(() =>
        assertResolvedAccess(access("verified", { issuer: "https://elsewhere.test" }), {
          issuer: ISSUER,
          matchers: {},
        }),
      ).toThrow(expect.objectContaining({ code: "access_token_claims_invalid" }));
    });

    // RFC 7662 §2.2 makes every introspection response member a MAY, `iss`
    // included, and the issuer is established by which endpoint was called.
    test("accepts an ABSENT issuer", () => {
      expect(() =>
        assertResolvedAccess(access("introspected", { subject: "alice" }), {
          issuer: ISSUER,
          matchers: {},
        }),
      ).not.toThrow();
    });

    // A deployment that settled no issuer has nothing to pin an opaque
    // credential to — so no matcher is emitted at all, rather than one that
    // matches everything.
    test("emits no issuer matcher when the deployment settled none", () => {
      expect(() =>
        assertResolvedAccess(access("introspected", { issuer: "https://whoever.test" }), {
          issuer: null,
          matchers: {},
        }),
      ).not.toThrow();
    });
  });

  describe("caller matchers", () => {
    // ⚠ The scalar-against-array lift. `audience` is array-valued in domain
    // form, and "aud contains this one identity" is the form a resource server
    // writes for itself (RFC 9068 §4).
    test("accepts a scalar audience the claim array contains", () => {
      expect(() =>
        assertResolvedAccess(
          access("introspected", { audience: ["https://a.test", "https://b.test"] }),
          { issuer: null, matchers: { audience: "https://a.test" } },
        ),
      ).not.toThrow();
    });

    test("refuses a scalar audience the claim array lacks", () => {
      expect(() =>
        assertResolvedAccess(access("introspected", { audience: ["https://b.test"] }), {
          issuer: null,
          matchers: { audience: "https://a.test" },
        }),
      ).toThrow(
        expect.objectContaining({
          data: { invalid: ["audience"], provenance: "introspected" },
        }),
      );
    });

    test("requires EVERY listed scope, not any", () => {
      expect(() =>
        assertResolvedAccess(access("verified", { scope: ["openid", "profile"] }), {
          issuer: null,
          matchers: { scope: ["openid", "orders:write"] },
        }),
      ).toThrow(expect.objectContaining({ code: "access_token_claims_invalid" }));
    });

    test("reports EVERY failing key, not just the first", () => {
      try {
        assertResolvedAccess(access("verified", { issuer: ISSUER, scope: ["openid"] }), {
          issuer: ISSUER,
          matchers: { audience: "https://a.test", scope: "orders:write" },
        });
        expect.fail("expected assertResolvedAccess to throw");
      } catch (error: any) {
        expect(error.data.invalid.sort()).toEqual(["audience", "scope"]);
      }
    });

    // A caller matcher named `issuer` would be a second opinion on a value the
    // deployment already settled. It cannot be written — `UseAccessTokenOptions`
    // omits it — but the spread order is what enforces it, so pin the order.
    test("a caller matcher wins the spread, so the order is pinned", () => {
      expect(() =>
        assertResolvedAccess(access("verified", { issuer: "https://caller.test" }), {
          issuer: ISSUER,
          matchers: { issuer: "https://caller.test" } as any,
        }),
      ).not.toThrow();
    });
  });

  test("throws a ClientError with a 401 status", () => {
    try {
      assertResolvedAccess(access("verified", { audience: [] }), {
        issuer: null,
        matchers: { audience: "https://a.test" },
      });
      expect.fail("expected assertResolvedAccess to throw");
    } catch (error: any) {
      expect(error).toBeInstanceOf(ClientError);
      expect(error.status).toBe(401);
      expect(error.type).toBe("urn:lindorm:pylon:error:access_token_claims_invalid");
    }
  });

  test("passes an empty matcher set", () => {
    expect(() =>
      assertResolvedAccess(access("verified", {}), { issuer: null, matchers: {} }),
    ).not.toThrow();
  });
});
