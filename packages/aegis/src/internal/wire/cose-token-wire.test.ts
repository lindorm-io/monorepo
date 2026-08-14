import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { describe, expect, test } from "vitest";
import { TEST_EC_KEY_SIG } from "../../__fixtures__/keys.js";
import { CwtKit } from "../../classes/CwtKit.js";
import { Tag, decodeCbor, encodeCbor } from "../cose/cbor.js";
import { decodeProtectedHeader, encodeProtectedHeader } from "../cose/structures.js";
import { parseToken } from "../utils/parse-token.js";
import { COSE_TOKEN_WIRE } from "./cose-token-wire.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

/**
 * The COSE wire's KEYLESS claims read — the `aegis.parse` half of the CWT
 * envelope gates, and the twin of `jose-token-wire.test.ts`.
 *
 * A keyless parse checks no signature, but it still has to refuse a token whose
 * own ENVELOPE is malformed, because everything downstream reads the result as a
 * CWT. The JOSE side has always done that; this side did not, so
 * `aegis.parse(cwt)` accepted a `typ` naming another media type entirely and a
 * `crit` naming a parameter the header does not carry — RFC 9052 §3.1 calls the
 * latter "a fatal error in processing" — while `aegis.parse(jwt)` refused both.
 * A rule honoured on one encoding and skipped on the other is a rule an attacker
 * chooses to be bound by, since the encoding is the issuer's choice.
 *
 * `assert-wire-typ.test.ts` pins the PREDICATE against configs it declares
 * itself, so it stays green over a call site that never runs it. This drives the
 * real wire.
 */
describe("COSE_TOKEN_WIRE keyless read gates", () => {
  const kit = new CwtKit({ logger: createMockLogger(), kryptos: TEST_EC_KEY_SIG });

  /**
   * A real CWT with its PROTECTED bucket rewritten — the same instrument the
   * JOSE twin uses, and for the same reason: a sign floor would never emit one
   * of these, and the broken signature is irrelevant to a keyless read.
   *
   * ⚠ The labels are spelled as RFC 9052 §3.1 Table 2 numbers rather than read
   * off the registry the wire itself reads, so the test states the WIRE and not
   * the package's opinion of it.
   */
  const rewritten = (edit: (header: Map<number | string, unknown>) => void): string => {
    const tags: Array<number> = [];
    let value: unknown = decodeCbor(kit.sign({ iss: "https://test.lindorm.io/" }));

    while (value instanceof Tag) {
      tags.push(Number(value.tag));
      value = value.contents;
    }

    const structure = value as Array<unknown>;
    const header = decodeProtectedHeader(structure[0] as Uint8Array);

    edit(header);

    let rebuilt: unknown = [encodeProtectedHeader(header), ...structure.slice(1)];

    for (const tag of [...tags].reverse()) rebuilt = new Tag(tag, rebuilt);

    return encodeCbor(rebuilt).toString("base64url");
  };

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

  // Label 16 is `typ` (RFC 9596 §4.1). The value names a JOSE encryption media
  // type — nothing a COSE claims reader can honour — and RFC 9596 §2 makes the
  // parameter the declaration of what the whole COSE object IS.
  const evilTyp = (): string =>
    rewritten((header) => header.set(16, "application/evil+jwe"));

  // Label 2 is `crit` (RFC 9052 §3.1 Table 2), naming a parameter the header
  // does not carry — the shape §3.1 calls a fatal error.
  const unknownCrit = (): string => rewritten((header) => header.set(2, ["fake-param"]));

  test("the keyless wire read refuses a foreign typ in its OWN words", () => {
    expect(refusalOf(() => COSE_TOKEN_WIRE.decodeClaims(evilTyp()))).toMatchSnapshot();
  });

  test("the keyless wire read refuses an unresolvable crit", () => {
    expect(
      refusalOf(() => COSE_TOKEN_WIRE.decodeClaims(unknownCrit())),
    ).toMatchSnapshot();
  });

  test("both refusals reach an aegis.parse caller unchanged", () => {
    // `parseToken` IS `aegis.parse`; the wire is the only thing that answers it.
    expect(refusalOf(() => parseToken(evilTyp()))).toMatchSnapshot();
    expect(refusalOf(() => parseToken(unknownCrit()))).toMatchSnapshot();
  });

  test("⚠ the parse-side and verify-side typ wordings DIFFER, deliberately", () => {
    // Same code, same title, one word apart — and the word is the operation the
    // caller actually asked for. `CwtKit.verify` is about to check a signature,
    // so it says the token "cannot be verified"; the wire read is keyless and
    // checks nothing, so it says "cannot be parsed". Telling a parse caller their
    // token cannot be VERIFIED would name a check that path never runs.
    //
    // ⛔ The two are NOT a copy-paste slip. Do not collapse them.
    const token = evilTyp();

    const parsed = refusalOf(() => COSE_TOKEN_WIRE.decodeClaims(token)) as {
      code: string;
      details: string;
    };
    const verified = refusalOf(() => kit.verify(Buffer.from(token, "base64url"))) as {
      code: string;
      details: string;
    };

    expect(parsed.code).toBe("cwt_invalid_typ");
    expect(verified.code).toBe("cwt_invalid_typ");

    expect(parsed.details).toContain("cannot be parsed as a CWT");
    expect(verified.details).toContain("cannot be verified as a CWT");
    expect(parsed.details).not.toBe(verified.details);
  });
});
