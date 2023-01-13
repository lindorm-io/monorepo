import { assertPKCE } from "./assert-pkce";
import { createHash } from "crypto";

describe("assertPKCE", () => {
  let pkceChallenge: string;
  let pkceVerifier: string;

  beforeEach(() => {
    pkceVerifier = "mM0DsmDihpzJxV_uMR-a2GMbfc2QX0i7jaq0a2SsmWI";
    pkceChallenge = createHash("sha256").update(pkceVerifier, "utf8").digest("base64url");
  });

  test("should resolve for S256", async () => {
    expect(() => assertPKCE(pkceChallenge, "S256", pkceVerifier)).not.toThrow();
  });

  test("should fail for S256", async () => {
    expect(() => assertPKCE(pkceChallenge, "S256", "wrong")).toThrow();
  });

  test("should resolve for PLAIN", async () => {
    expect(() => assertPKCE(pkceChallenge, "plain", pkceChallenge)).not.toThrow();
  });

  test("should fail for PLAIN", async () => {
    expect(() => assertPKCE(pkceChallenge, "plain", "wrong")).toThrow();
  });
});
