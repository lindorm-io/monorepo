import { Amphora, type IAmphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import { TEST_EC_KEY_SIG, TEST_OCT_KEY_ENC } from "../__fixtures__/keys.js";
import { encodeCbor } from "../internal/cose/cbor.js";
import { domainToJose, joseToDomain } from "../internal/claims/translate.js";
import { Aegis } from "./Aegis.js";
import { CwsKit } from "./CwsKit.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

const seg = (obj: unknown): string =>
  Buffer.from(JSON.stringify(obj)).toString("base64url");

// A well-formed JOSE JWT string — the dotted counter-example the COSE guards
// must reject before any CBOR work.
const JWT = `${seg({ alg: "ES256", typ: "JWT" })}.${seg({ sub: "user_1" })}.sig`;

describe("Aegis — COSE format guards", () => {
  let amphora: IAmphora;
  let aegis: Aegis;
  let cwt: string;
  let cwe: string;
  let cws: string;

  beforeEach(async () => {
    const logger = createMockLogger();
    amphora = new Amphora({ domain: "https://test.lindorm.io/", logger });
    aegis = new Aegis({ amphora, logger });
    await amphora.setup();
    amphora.add(TEST_EC_KEY_SIG); // ES512 signer
    amphora.add(TEST_OCT_KEY_ENC); // dir recipient for COSE_Encrypt0

    // CWT — a real claims-bearing COSE_Sign1 (typ `<type>+cwt`).
    cwt = (
      await aegis.cwt.sign({
        subject: "user-1",
        audience: ["https://rs.lindorm.io/"],
        expires: "1h",
        tokenType: "access_token",
      })
    ).token;

    // CWE — a COSE_Encrypt0 (structural).
    cwe = (await aegis.cwe.encrypt("hello cose")).token;

    // CWS — an opaque signed COSE_Sign1 carrying a `<type>+cws` typ (the opaque
    // format the guard recognises, distinct from a claims CWT by its media type,
    // exactly as isJws distinguishes a `+jws` JWS from a `+jwt` JWT).
    cws = Buffer.from(
      encodeCbor(
        new CwsKit({ kryptos: TEST_EC_KEY_SIG, logger }).sign(
          Buffer.from("opaque payload"),
          { typ: "application/example+cws" },
        ),
      ),
    ).toString("base64url");
  });

  test("isCwt — true for a CWT, false for JWT / CWS / CWE", () => {
    expect(Aegis.isCwt(cwt)).toBe(true);
    expect(Aegis.isCwt(cws)).toBe(false);
    expect(Aegis.isCwt(cwe)).toBe(false);
    expect(Aegis.isCwt(JWT)).toBe(false);
    expect(Aegis.isCwt("not a token")).toBe(false);
  });

  test("isCws — true for a CWS, false for JWT / CWT / CWE", () => {
    expect(Aegis.isCws(cws)).toBe(true);
    expect(Aegis.isCws(cwt)).toBe(false);
    expect(Aegis.isCws(cwe)).toBe(false);
    expect(Aegis.isCws(JWT)).toBe(false);
    expect(Aegis.isCws("not a token")).toBe(false);
  });

  test("isCwe — true for a CWE, false for JWT / CWT / CWS", () => {
    expect(Aegis.isCwe(cwe)).toBe(true);
    expect(Aegis.isCwe(cwt)).toBe(false);
    expect(Aegis.isCwe(cws)).toBe(false);
    expect(Aegis.isCwe(JWT)).toBe(false);
    expect(Aegis.isCwe("not a token")).toBe(false);
  });

  test("every COSE token is COSE, no JOSE token is", () => {
    for (const token of [cwt, cws, cwe]) {
      expect(Aegis.isCose(token)).toBe(true);
      expect(Aegis.isJose(token)).toBe(false);
    }
    expect(Aegis.isCose(JWT)).toBe(false);
  });
});

describe("Aegis — toDomain / toWire statics", () => {
  test("ARE the claim translator functions (source of truth, Bit 8)", () => {
    expect(Aegis.toWire).toBe(domainToJose);
    expect(Aegis.toDomain).toBe(joseToDomain);
  });

  test("round-trips domain claims through wire and back", () => {
    const common = {
      subject: "user-1",
      issuer: "https://idp.lindorm.io/",
      tokenId: "tok_abc",
      audience: ["https://rs.lindorm.io/"],
      customFlag: true,
    };

    const wire = Aegis.toWire(common);

    // Registered claims take their JOSE wire names; a custom key snake-cases.
    expect(wire.sub).toBe("user-1");
    expect(wire.iss).toBe("https://idp.lindorm.io/");
    expect(wire.jti).toBe("tok_abc");
    expect(wire.aud).toEqual(["https://rs.lindorm.io/"]);
    expect(wire.custom_flag).toBe(true);

    const { claims, custom } = Aegis.toDomain(wire);

    expect(claims.subject).toBe("user-1");
    expect(claims.issuer).toBe("https://idp.lindorm.io/");
    expect(claims.tokenId).toBe("tok_abc");
    expect(claims.audience).toEqual(["https://rs.lindorm.io/"]);
    expect(custom.customFlag).toBe(true);
  });
});
