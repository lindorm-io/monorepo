import { verifyPKCE } from "./verify-pkce";
import { createHash } from "crypto";
import { PKCEMethod } from "@lindorm-io/common-types";

describe("verifyPKCE", () => {
  let pkceChallenge: string;
  let pkceVerifier: string;

  beforeEach(() => {
    pkceVerifier = "mM0DsmDihpzJxV_uMR-a2GMbfc2QX0i7jaq0a2SsmWI";
    pkceChallenge = createHash("sha256").update(pkceVerifier, "utf8").digest("base64url");
  });

  test("should resolve for S256", () => {
    expect(verifyPKCE(pkceChallenge, PKCEMethod.SHA256, pkceVerifier)).toBe(true);
  });

  test("should fail for S256", () => {
    expect(verifyPKCE(pkceChallenge, PKCEMethod.SHA256, "wrong")).toBe(false);
  });

  test("should resolve for PLAIN", () => {
    expect(verifyPKCE(pkceChallenge, PKCEMethod.PLAIN, pkceChallenge)).toBe(true);
  });

  test("should fail for PLAIN", () => {
    expect(verifyPKCE(pkceChallenge, PKCEMethod.PLAIN, "wrong")).toBe(false);
  });

  test("should throw on invalid method", () => {
    // @ts-ignore
    expect(() => verifyPKCE(pkceChallenge, "wrong", pkceVerifier)).toThrow();
  });
});
