import { PkceMethod } from "@lindorm/types";
import { createHash } from "crypto";
import { assertPkce } from "./assert-pkce";

describe("assertPkce", () => {
  let pkceChallenge: string;
  let pkceVerifier: string;

  beforeEach(() => {
    pkceVerifier = "mM0DsmDihpzJxV_uMR-a2GMbfc2QX0i7jaq0a2SsmWI";
    pkceChallenge = createHash("sha256").update(pkceVerifier, "utf8").digest("base64url");
  });

  test("should resolve for S256", async () => {
    expect(() => assertPkce(pkceChallenge, pkceVerifier, "S256")).not.toThrow();
  });

  test("should fail for S256", async () => {
    expect(() => assertPkce(pkceChallenge, "wrong", "S256")).toThrow();
  });

  test("should resolve for plain", async () => {
    expect(() => assertPkce(pkceChallenge, pkceChallenge, "plain")).not.toThrow();
  });

  test("should fail for plain", async () => {
    expect(() => assertPkce(pkceChallenge, "wrong", "plain")).toThrow();
  });
});
