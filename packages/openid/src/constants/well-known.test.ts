import { describe, expect, test } from "vitest";
import {
  WELL_KNOWN_JWKS,
  WELL_KNOWN_OAUTH_AUTHORIZATION_SERVER,
  WELL_KNOWN_OAUTH_PROTECTED_RESOURCE,
  WELL_KNOWN_OPENID_CONFIGURATION,
} from "./well-known.js";

describe("well-known", () => {
  test("should match snapshot", () => {
    expect({
      WELL_KNOWN_JWKS,
      WELL_KNOWN_OAUTH_AUTHORIZATION_SERVER,
      WELL_KNOWN_OAUTH_PROTECTED_RESOURCE,
      WELL_KNOWN_OPENID_CONFIGURATION,
    }).toMatchSnapshot();
  });

  test("should resolve against an issuer origin", () => {
    expect(
      new URL(WELL_KNOWN_OPENID_CONFIGURATION, "https://test.lindorm.io").toString(),
    ).toBe("https://test.lindorm.io/.well-known/openid-configuration");
  });
});
