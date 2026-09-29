import { AegisDomainError } from "@lindorm/aegis";
import { describe, expect, test } from "vitest";
import { IntrospectionEndpointFailed } from "../../../errors/IntrospectionEndpointFailed.js";
import type { PylonIntrospectionActive } from "../../../types/index.js";
import { type IntrospectClaimsInput, parseIntrospection } from "./parse-introspection.js";

const parseActive = (data: IntrospectClaimsInput): PylonIntrospectionActive => {
  const result = parseIntrospection(data);
  if (!result.active) throw new Error("Expected active introspection");
  return result;
};

describe("parseIntrospection", () => {
  test("should map full RFC 7662 response to PylonIntrospection", () => {
    const data: IntrospectClaimsInput = {
      active: true,
      sub: "user-intro-123",
      client_id: "client-abc",
      scope: "openid profile email",
      token_type: "bearer",
      exp: 1700003600,
      iat: 1700000000,
      nbf: 1700000000,
      iss: "https://auth.example.com",
      aud: ["https://api.example.com", "https://other.example.com"],
      jti: "tok-intro-456",
      username: "johndoe",
    };

    const result = parseActive(data);

    expect(result).toMatchSnapshot();
  });

  test("should handle active false with minimal fields", () => {
    const data = {
      active: false,
      aud: [],
      clientId: null,
      exp: 0,
      iat: 0,
      iss: null,
      jti: null,
      nbf: 0,
      scope: null,
      sub: null,
      tokenType: null,
      username: null,
    } satisfies IntrospectClaimsInput;

    const result = parseIntrospection(data);

    expect(result).toMatchSnapshot();
  });

  test("should map Lindorm extension fields", () => {
    const data = {
      active: true,
      sub: "user-ext-789",
      client_id: "client-ext",
      scope: "openid",
      token_type: "bearer",
      exp: 1700003600,
      iat: 1700000000,
      nbf: 1700000000,
      iss: "https://auth.example.com",
      aud: ["https://api.example.com"],
      jti: "tok-ext-123",
      username: "janedoe",
      // Lindorm extensions
      tenant_id: "tenant-abc",
      roles: ["admin", "user"],
      permissions: ["read", "write"],
      loa: 3,
      sid: "session-xyz",
      sih: "browser",
      suh: "identity",
      gty: "authorization_code",
      afr: "2fa",
      afc: ["knowledge", "possession"],
      entitlements: ["premium"],
      groups: ["engineering", "leads"],
    } as IntrospectClaimsInput;

    const result = parseActive(data);

    expect(result).toMatchSnapshot();
  });

  test("should surface authorization_details as authorizationDetails (RFC 9396)", () => {
    const data = {
      active: true,
      sub: "user-rar-123",
      client_id: "client-rar",
      scope: "payment",
      token_type: "bearer",
      exp: 1700003600,
      iat: 1700000000,
      nbf: 1700000000,
      iss: "https://auth.example.com",
      aud: ["https://api.example.com"],
      jti: "tok-rar-456",
      username: "rardoe",
      authorization_details: [
        {
          type: "payment_initiation",
          actions: ["initiate"],
          locations: ["https://api.bank.example.com/payments"],
          instructedAmount: { currency: "EUR", amount: "123.50" },
        },
      ],
    } as IntrospectClaimsInput;

    const result = parseActive(data);

    expect(result.authorizationDetails).toMatchSnapshot();
    expect(result).not.toHaveProperty("authorization_details");
    expect(result.authorizationDetails![0].instructedAmount).toEqual({
      currency: "EUR",
      amount: "123.50",
    });
  });

  test("should throw IntrospectionEndpointFailed when active is missing", () => {
    const data = {
      sub: "user-123",
      clientId: "client-abc",
    } as unknown as IntrospectClaimsInput;

    expect(() => parseIntrospection(data)).toThrow(IntrospectionEndpointFailed);
    expect(() => parseIntrospection(data)).toThrow("Missing active claim");
  });

  test("should throw IntrospectionEndpointFailed when active is not a boolean", () => {
    const data = {
      active: "yes",
      sub: "user-123",
    } as unknown as IntrospectClaimsInput;

    expect(() => parseIntrospection(data)).toThrow(IntrospectionEndpointFailed);
    expect(() => parseIntrospection(data)).toThrow("Missing active claim");
  });

  // The refusal must reach the caller: `parseIntrospection` wraps no aegis error,
  // so a domain-spelled claim fails loudly instead of being read as absent.
  test("should refuse a registered claim stated under its domain name", () => {
    const read = () =>
      parseIntrospection({
        active: true,
        sub: "user-domain-spelling",
        nationalIdentityNumber: "01019012345",
      });

    expect(read).toThrow(AegisDomainError);
    expect(read).toThrow(
      expect.objectContaining({
        code: "claim_structure_invalid",
        data: {
          claim: "nationalIdentityNumber",
          invalid: [
            {
              key: "nationalIdentityNumber",
              message:
                'Claim "nationalIdentityNumber" must be stated under its wire name "national_identity_number"',
            },
          ],
        },
      }) as unknown as Error,
    );
  });

  test("should split scope string into array", () => {
    const data = {
      active: true,
      sub: "user-scope",
      client_id: null,
      scope: "openid profile email offline_access",
      token_type: null,
      exp: 1700003600,
      iat: 1700000000,
      nbf: 1700000000,
      iss: null,
      aud: [],
      jti: null,
      username: null,
    } satisfies IntrospectClaimsInput;

    const result = parseActive(data);

    expect(result.scope).toMatchSnapshot();
  });

  test("should resolve the loa wire name to levelOfAssurance", () => {
    const data = {
      active: true,
      sub: "user-loa",
      client_id: null,
      scope: null,
      token_type: null,
      exp: 1700003600,
      iat: 1700000000,
      nbf: 1700000000,
      iss: null,
      aud: [],
      jti: null,
      username: null,
      loa: 2,
    } as IntrospectClaimsInput;

    const result = parseActive(data);

    expect(result.levelOfAssurance).toBe(2);
  });

  test("should bucket an unregistered level_of_assurance without displacing the registered loa", () => {
    const data = {
      active: true,
      sub: "user-both",
      client_id: null,
      scope: null,
      token_type: null,
      exp: 1700003600,
      iat: 1700000000,
      nbf: 1700000000,
      iss: null,
      aud: [],
      jti: null,
      username: null,
      loa: 2,
      level_of_assurance: 4,
    } as IntrospectClaimsInput;

    const result = parseActive(data);

    expect(result.levelOfAssurance).toBe(2);
    expect(result.custom).toEqual({ levelOfAssurance: 4 });
  });

  test("should convert epoch timestamps to Date objects", () => {
    const data: IntrospectClaimsInput = {
      active: true,
      sub: "user-dates",
      client_id: null,
      scope: null,
      token_type: null,
      exp: 1700003600,
      iat: 1700000000,
      nbf: 1699999000,
      iss: null,
      aud: [],
      jti: null,
      username: null,
    };

    const result = parseActive(data);

    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(result.issuedAt).toBeInstanceOf(Date);
    expect(result.notBefore).toBeInstanceOf(Date);
    expect(result.expiresAt!.getTime()).toBe(1700003600 * 1000);
    expect(result.issuedAt!.getTime()).toBe(1700000000 * 1000);
    expect(result.notBefore!.getTime()).toBe(1699999000 * 1000);
  });

  // RFC 7662 §2.2 lets the server return members the registry has never heard
  // of. They are the deployment's own extension claims, so they are kept —
  // bucketed, not flattened, so a consumer can tell them from a registered claim.
  describe("custom claims", () => {
    test("should bucket the unregistered members under custom", () => {
      const result = parseActive({
        active: true,
        sub: "user-custom",
        tenant_tier: "gold",
        feature_flags: ["beta-search"],
      });

      expect(result.custom).toEqual({
        tenantTier: "gold",
        featureFlags: ["beta-search"],
      });
      expect(result.subject).toBe("user-custom");
    });

    // ALWAYS an object — a sometimes-absent field invites `null` reaches at
    // every read site.
    test("should be an empty object when the response carries none", () => {
      const result = parseActive({ active: true, sub: "user-plain" });

      expect(result.custom).toEqual({});
    });

    // `active`/`token_type`/`username` describe the ANSWER (RFC 7662 §2.2), not
    // the token, and no claim registry entry exists for any of them — so the
    // translator hands all three back as "unregistered". They have their own
    // places on this shape and must not be repeated as extension claims.
    test("should keep the RFC 7662 response members out of the bucket", () => {
      const result = parseActive({
        active: true,
        sub: "user-members",
        token_type: "bearer",
        username: "johndoe",
      });

      expect(result.custom).toEqual({});
      expect(result.tokenType).toBe("bearer");
      expect(result.username).toBe("johndoe");
    });

    // `custom` is RESERVED at the top level, so a server that returns a member
    // of that name is not ambiguous and not lost — it is unregistered like every
    // other extension claim, so it lands INSIDE the bucket.
    test("should nest a member literally named custom inside the bucket", () => {
      const result = parseActive({
        active: true,
        sub: "user-collision",
        custom: { nested: "value" },
      });

      expect(result.custom).toEqual({ custom: { nested: "value" } });
    });

    // The profile carve-out is unchanged: an introspection answer is not a
    // userinfo response, and dropping a volunteered name/email must not be
    // routed around by the new bucket.
    test("should still drop the profile claims rather than bucket them", () => {
      const result = parseActive({
        active: true,
        sub: "user-profile",
        email: "user@lindorm.io",
        given_name: "Jane",
      });

      expect(result).not.toHaveProperty("email");
      expect(result).not.toHaveProperty("givenName");
      expect(result.custom).toEqual({});
    });

    /**
     * The SENSITIVE carve-out, the profile carve-out's twin. Aegis partitions
     * the `category: "sensitive"` claims into their own bucket and surfaces them
     * only on an encrypted token (OIDC Core §13.3) — so a locally verified token
     * NEVER resolves a national identity number into `claims`, and until now an
     * introspection answer did.
     *
     * That was both a divergence between the two provenances and a leak of a
     * kind `PylonResolvedAccess` exists to prevent: it answers ONE question —
     * may this request do this — and a national identity number bears on none
     * of it. `DomainClaims` does not declare these fields at all, so letting
     * them through also made the type a lie.
     */
    test("should drop the sensitive identity claims rather than bucket them", () => {
      const result = parseActive({
        active: true,
        sub: "user-sensitive",
        national_identity_number: "01019012345",
        national_identity_number_verified: true,
        social_security_number: "078-05-1120",
        social_security_number_verified: false,
      });

      expect(result).not.toHaveProperty("nationalIdentityNumber");
      expect(result).not.toHaveProperty("nationalIdentityNumberVerified");
      expect(result).not.toHaveProperty("socialSecurityNumber");
      expect(result).not.toHaveProperty("socialSecurityNumberVerified");
      expect(result.custom).toEqual({});
      expect(JSON.stringify(result)).not.toContain("01019012345");
    });
  });

  test("should wrap single audience string in array", () => {
    const data = {
      active: true,
      sub: "user-aud",
      client_id: null,
      scope: null,
      token_type: null,
      exp: 1700003600,
      iat: 1700000000,
      nbf: 1700000000,
      iss: null,
      aud: "https://single.example.com",
      jti: null,
      username: null,
    } as unknown as IntrospectClaimsInput;

    const result = parseActive(data);

    expect(result.audience).toMatchSnapshot();
  });
});
