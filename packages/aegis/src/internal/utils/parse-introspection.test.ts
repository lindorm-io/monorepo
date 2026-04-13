import { AegisError } from "../../errors";
import { AegisIntrospectionActive } from "../../types";
import { IntrospectClaimsInput, parseIntrospection } from "./parse-introspection";

const parseActive = (data: IntrospectClaimsInput): AegisIntrospectionActive => {
  const result = parseIntrospection(data);
  if (!result.active) throw new Error("Expected active introspection");
  return result;
};

describe("parseIntrospection", () => {
  test("should map full RFC 7662 response to AegisIntrospection", () => {
    const data: IntrospectClaimsInput = {
      active: true,
      sub: "user-intro-123",
      clientId: "client-abc",
      scope: "openid profile email",
      tokenType: "bearer",
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
      clientId: "client-ext",
      scope: "openid",
      tokenType: "bearer",
      exp: 1700003600,
      iat: 1700000000,
      nbf: 1700000000,
      iss: "https://auth.example.com",
      aud: ["https://api.example.com"],
      jti: "tok-ext-123",
      username: "janedoe",
      // Lindorm extensions
      tenantId: "tenant-abc",
      roles: ["admin", "user"],
      permissions: ["read", "write"],
      levelOfAssurance: 3,
      adjustedAccessLevel: 2,
      sessionId: "session-xyz",
      sessionHint: "browser",
      subjectHint: "identity",
      grantType: "authorization_code",
      authFactor: ["pwd", "otp"],
      entitlements: ["premium"],
      groups: ["engineering", "leads"],
    } as IntrospectClaimsInput;

    const result = parseActive(data);

    expect(result).toMatchSnapshot();
  });

  test("should throw AegisError when active is missing", () => {
    const data = {
      sub: "user-123",
      clientId: "client-abc",
    } as unknown as IntrospectClaimsInput;

    expect(() => parseIntrospection(data)).toThrow(AegisError);
    expect(() => parseIntrospection(data)).toThrow("Missing active claim");
  });

  test("should throw AegisError when active is not a boolean", () => {
    const data = {
      active: "yes",
      sub: "user-123",
    } as unknown as IntrospectClaimsInput;

    expect(() => parseIntrospection(data)).toThrow(AegisError);
    expect(() => parseIntrospection(data)).toThrow("Missing active claim");
  });

  test("should split scope string into array", () => {
    const data = {
      active: true,
      sub: "user-scope",
      clientId: null,
      scope: "openid profile email offline_access",
      tokenType: null,
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

  test("should handle loa and aal shorthand fields", () => {
    const data = {
      active: true,
      sub: "user-loa",
      clientId: null,
      scope: null,
      tokenType: null,
      exp: 1700003600,
      iat: 1700000000,
      nbf: 1700000000,
      iss: null,
      aud: [],
      jti: null,
      username: null,
      loa: 2,
      aal: 1,
    } as IntrospectClaimsInput;

    const result = parseActive(data);

    expect(result.levelOfAssurance).toBe(2);
    expect(result.adjustedAccessLevel).toBe(1);
  });

  test("should prefer long-form over shorthand when both present", () => {
    const data = {
      active: true,
      sub: "user-both",
      clientId: null,
      scope: null,
      tokenType: null,
      exp: 1700003600,
      iat: 1700000000,
      nbf: 1700000000,
      iss: null,
      aud: [],
      jti: null,
      username: null,
      levelOfAssurance: 4,
      loa: 2,
      adjustedAccessLevel: 3,
      aal: 1,
    } as IntrospectClaimsInput;

    const result = parseActive(data);

    expect(result.levelOfAssurance).toBe(4);
    expect(result.adjustedAccessLevel).toBe(3);
  });

  test("should convert epoch timestamps to Date objects", () => {
    const data: IntrospectClaimsInput = {
      active: true,
      sub: "user-dates",
      clientId: null,
      scope: null,
      tokenType: null,
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

  test("should wrap single audience string in array", () => {
    const data = {
      active: true,
      sub: "user-aud",
      clientId: null,
      scope: null,
      tokenType: null,
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
