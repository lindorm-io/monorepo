import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { beforeEach, describe, expect, test } from "vitest";
import { TEST_EC_KEY_SIG } from "../../__fixtures__/keys.js";
import { JwtKit } from "../../classes/JwtKit.js";
import { parseToken } from "../utils/parse-token.js";
import { JOSE_TOKEN_WIRE } from "./jose-token-wire.js";

/**
 * The JOSE wire's KEYLESS claims read — the `aegis.parse` half of the JWT typ gate,
 * which no other suite reaches.
 *
 * ⚠ `assert-wire-typ.test.ts` pins the PREDICATE against configs it declares itself,
 * so it stays green no matter what the call sites pass. This drives the two real
 * sites and pins what distinguishes them: their WORDING.
 */
describe("JOSE_TOKEN_WIRE typ gate", () => {
  let logger: ReturnType<typeof createMockLogger>;
  let kit: JwtKit;
  let token: string;

  beforeEach(() => {
    logger = createMockLogger();
    kit = new JwtKit({ logger, kryptos: TEST_EC_KEY_SIG });

    // A signed JWT whose header typ is rewritten outside the JWT media-type family.
    // The broken signature is irrelevant — both gates run before it.
    //
    // ⚠ The spelling matters: an opaque `JWS`/`JOSE`/`+jws` typ would make `isJwt`
    // false, so `parse` would refuse the token as an opaque JWS before the wire read
    // it at all.
    const signed = kit.sign({ iss: "https://test.lindorm.io/", sub: "s" });
    const [, payload, signature] = signed.split(".");
    const header = Buffer.from(
      JSON.stringify({ ...JwtKit.decode(signed).header, typ: "not-a-jwt-typ" }),
    ).toString("base64url");

    token = [header, payload, signature].join(".");
  });

  const refusalOf = (fn: () => unknown): unknown => {
    try {
      fn();
    } catch (error) {
      const { code, title, details } = error as {
        code?: string;
        title?: string;
        details?: string;
      };
      return { code, title, details };
    }

    throw new Error("expected a refusal");
  };

  test("the keyless wire read refuses a foreign typ in its OWN words", () => {
    expect(refusalOf(() => JOSE_TOKEN_WIRE.decodeClaims(token))).toMatchSnapshot();
  });

  test("the refusal reaches an aegis.parse caller unchanged", () => {
    // `parseToken` IS `aegis.parse`; the wire is the only thing that answers it.
    expect(refusalOf(() => parseToken(token))).toMatchSnapshot();
  });

  test("⚠ the parse-side and verify-side wordings DIFFER, deliberately", () => {
    // ⛔ NOT a copy-paste slip — do not collapse them. The word is the operation the
    // caller asked for: telling a parse caller their token cannot be VERIFIED would
    // name a check that path never runs.
    const parsed = refusalOf(() => JOSE_TOKEN_WIRE.decodeClaims(token)) as {
      code: string;
      details: string;
    };
    const verified = refusalOf(() => kit.verify(token)) as {
      code: string;
      details: string;
    };

    expect(parsed.code).toBe("jwt_invalid_typ");
    expect(verified.code).toBe("jwt_invalid_typ");

    expect(parsed.details).toContain("cannot be parsed as a JWT");
    expect(verified.details).toContain("cannot be verified as a JWT");
    expect(parsed.details).not.toBe(verified.details);
  });
});
