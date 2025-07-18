import { createHash } from "crypto";
import { verifyPkce } from "./verify-pkce";

describe("verifyPkce", () => {
  let pkceChallenge: string;
  let pkceVerifier: string;

  beforeEach(() => {
    pkceVerifier = "mM0DsmDihpzJxV_uMR-a2GMbfc2QX0i7jaq0a2SsmWI";
    pkceChallenge = createHash("sha256").update(pkceVerifier, "utf8").digest("base64url");
  });

  test("should resolve for S256", () => {
    expect(verifyPkce(pkceChallenge, pkceVerifier, "S256")).toEqual(true);
  });

  test("should fail for S256", () => {
    expect(verifyPkce(pkceChallenge, "wrong", "S256")).toEqual(false);
  });

  test("should resolve for Plain", () => {
    expect(verifyPkce(pkceChallenge, pkceChallenge, "plain")).toEqual(true);
  });

  test("should fail for Plain", () => {
    expect(verifyPkce(pkceChallenge, "wrong", "plain")).toEqual(false);
  });

  test("should throw on invalid method", () => {
    // @ts-ignore
    expect(() => verifyPkce(pkceChallenge, pkceVerifier, "wrong")).toThrow();
  });
});
