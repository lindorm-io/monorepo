import { Aegis, type IAegis } from "@lindorm/aegis";
import { Amphora } from "@lindorm/amphora";
import { ClientError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { Dict } from "@lindorm/types";
import { describe, expect, test } from "vitest";
import {
  ACCESS_TEST_APP_ISSUER,
  ACCESS_TEST_AUDIENCE,
  accessClaims,
} from "../../../__fixtures__/access/tokens.js";
import type { AccessTokenMatchers, PylonResolvedAccess } from "../../../types/index.js";
import { assertResolvedAccess } from "./assert-resolved-access.js";

const logger = createMockLogger();

/** A real deployment holding no key: the claim gate reads its clock tolerance and nothing else. */
const deployment = (clockTolerance?: number): IAegis =>
  new Aegis({ amphora: new Amphora({ logger }), logger, clockTolerance });

const aegis = deployment();

const access = (
  provenance: PylonResolvedAccess["provenance"],
  claims: Dict = {},
): PylonResolvedAccess =>
  ({ provenance, custom: {}, token: "the-token", claims }) as PylonResolvedAccess;

/** The floor every mount states: its own identity, and nothing else. */
const MATCHERS: AccessTokenMatchers = { audience: ACCESS_TEST_AUDIENCE };

describe("assertResolvedAccess", () => {
  describe("issuer — the optional bound", () => {
    test("accepts a matching issuer", () => {
      expect(() =>
        assertResolvedAccess(aegis, access("verified", accessClaims()), {
          issuer: ACCESS_TEST_APP_ISSUER,
          matchers: MATCHERS,
        }),
      ).not.toThrow();
    });

    test("refuses a different issuer", () => {
      expect(() =>
        assertResolvedAccess(
          aegis,
          access("verified", accessClaims({ issuer: "https://elsewhere.test" })),
          { issuer: ACCESS_TEST_APP_ISSUER, matchers: MATCHERS },
        ),
      ).toThrow(expect.objectContaining({ code: "access_token_claims_invalid" }));
    });

    // RFC 7662 §2.2 makes `iss` a MAY, and the credential's provenance is
    // already pinned by WHICH issuer's introspection endpoint answered —
    // resolved before both arms. The claim is corroboration on a pin that holds
    // without it, so an absent one costs nothing.
    test("accepts an ABSENT issuer", () => {
      expect(() =>
        assertResolvedAccess(
          aegis,
          access("introspected", {
            audience: [ACCESS_TEST_AUDIENCE],
            subject: "alice",
          }),
          { issuer: ACCESS_TEST_APP_ISSUER, matchers: MATCHERS },
        ),
      ).not.toThrow();
    });

    // The bound tolerates only SILENCE. Any stated issuer is compared, whichever
    // arm resolved the credential — a verified token has no laxer reading of it
    // than an introspected one.
    test("refuses a different issuer on the introspected arm too", () => {
      expect(() =>
        assertResolvedAccess(
          aegis,
          access("introspected", accessClaims({ issuer: "https://elsewhere.test" })),
          { issuer: ACCESS_TEST_APP_ISSUER, matchers: MATCHERS },
        ),
      ).toThrow(
        expect.objectContaining({
          data: { invalid: ["issuer"], provenance: "introspected" },
        }),
      );
    });
  });

  describe("caller matchers", () => {
    // ⚠ The scalar-against-array lift. `audience` is array-valued in domain
    // form, and "aud contains this one identity" is the form a resource server
    // writes for itself (RFC 9068 §4).
    test("accepts a scalar audience the claim array contains", () => {
      expect(() =>
        assertResolvedAccess(
          aegis,
          access(
            "introspected",
            accessClaims({ audience: ["https://a.test", ACCESS_TEST_AUDIENCE] }),
          ),
          { issuer: ACCESS_TEST_APP_ISSUER, matchers: MATCHERS },
        ),
      ).not.toThrow();
    });

    test("refuses a scalar audience the claim array lacks", () => {
      expect(() =>
        assertResolvedAccess(
          aegis,
          access("introspected", accessClaims({ audience: ["https://b.test"] })),
          { issuer: ACCESS_TEST_APP_ISSUER, matchers: MATCHERS },
        ),
      ).toThrow(
        expect.objectContaining({
          data: { invalid: ["audience"], provenance: "introspected" },
        }),
      );
    });

    test("requires EVERY listed scope, not any", () => {
      expect(() =>
        assertResolvedAccess(
          aegis,
          access("verified", accessClaims({ scope: ["openid", "profile"] })),
          {
            issuer: ACCESS_TEST_APP_ISSUER,
            matchers: { ...MATCHERS, scope: ["openid", "orders:write"] },
          },
        ),
      ).toThrow(expect.objectContaining({ code: "access_token_claims_invalid" }));
    });

    test("reports EVERY failing key, not just the first", () => {
      try {
        assertResolvedAccess(
          aegis,
          access("verified", accessClaims({ scope: ["openid"] })),
          {
            issuer: ACCESS_TEST_APP_ISSUER,
            matchers: { audience: "https://a.test", scope: "orders:write" },
          },
        );
        expect.fail("expected assertResolvedAccess to throw");
      } catch (error: any) {
        expect(error.data.invalid.sort()).toEqual(["audience", "scope"]);
      }
    });

    // A caller matcher named `issuer` would be a second opinion on a value the
    // deployment already settled. It cannot be written — `AccessTokenMatchers`
    // omits it — but the spread order is what enforces it, so pin the order.
    test("a caller matcher wins the spread, so the order is pinned", () => {
      expect(() =>
        assertResolvedAccess(
          aegis,
          access("verified", accessClaims({ issuer: "https://caller.test" })),
          {
            issuer: ACCESS_TEST_APP_ISSUER,
            matchers: {
              ...MATCHERS,
              issuer: "https://caller.test",
            } as unknown as AccessTokenMatchers,
          },
        ),
      ).not.toThrow();
    });
  });

  // The window is the DEPLOYMENT's: one credential, ten seconds past its expiry,
  // is refused by a deployment allowing no clock tolerance and accepted by one
  // allowing thirty seconds. The gate reads the instance it is handed and keeps
  // no window of its own.
  describe("the temporal window is the deployment's clock tolerance", () => {
    const expired = (): Dict =>
      accessClaims({ expiresAt: new Date(Date.now() - 10_000) });

    test("refuses a credential expired ten seconds ago at a deployment allowing no clock tolerance", () => {
      expect(() =>
        assertResolvedAccess(deployment(0), access("verified", expired()), {
          issuer: ACCESS_TEST_APP_ISSUER,
          matchers: MATCHERS,
        }),
      ).toThrow(
        expect.objectContaining({
          data: { invalid: ["expiresAt"], provenance: "verified" },
        }),
      );
    });

    test("accepts the same credential at a deployment allowing a thirty-second clock tolerance", () => {
      expect(() =>
        assertResolvedAccess(deployment(30), access("verified", expired()), {
          issuer: ACCESS_TEST_APP_ISSUER,
          matchers: MATCHERS,
        }),
      ).not.toThrow();
    });
  });

  test("throws a ClientError with a 401 status", () => {
    try {
      assertResolvedAccess(aegis, access("verified", accessClaims({ audience: [] })), {
        issuer: ACCESS_TEST_APP_ISSUER,
        matchers: MATCHERS,
      });
      expect.fail("expected assertResolvedAccess to throw");
    } catch (error: any) {
      expect(error).toBeInstanceOf(ClientError);
      expect(error.status).toBe(401);
      expect(error.type).toBe("urn:lindorm:pylon:error:access_token_claims_invalid");
    }
  });

  // The narrowest matcher set a mount can express — `audience` is required, so
  // the issuer floor always runs beside it. Nothing beyond the two is asserted.
  test("passes when the mount states only the required audience", () => {
    expect(() =>
      assertResolvedAccess(aegis, access("verified", accessClaims()), {
        issuer: ACCESS_TEST_APP_ISSUER,
        matchers: MATCHERS,
      }),
    ).not.toThrow();
  });
});
