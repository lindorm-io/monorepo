import { PKCEMethod } from "../enum";
import { assertPKCE } from "./assert-pkce";
import { createHash } from "crypto";
import { getRandomString } from "./random-string";

describe("assertPKCE", () => {
  let pkceChallenge: string;
  let pkceVerifier: string;

  beforeEach(() => {
    pkceVerifier = getRandomString(32);
    pkceChallenge = createHash("sha256").update(pkceVerifier, "utf8").digest("base64");
  });

  test("should resolve for S256", async () => {
    expect(() => assertPKCE(pkceChallenge, PKCEMethod.S256, pkceVerifier)).not.toThrow();
  });

  test("should resolve for PLAIN", async () => {
    expect(() => assertPKCE(pkceChallenge, PKCEMethod.PLAIN, pkceChallenge)).not.toThrow();
  });
});
