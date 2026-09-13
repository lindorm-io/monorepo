import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { describe, expect, test } from "vitest";
import { TEST_EC_KEY_SIG, TEST_OCT_KEY_SIG } from "../../__fixtures__/keys.js";
import { CwmKit } from "../../classes/CwmKit.js";
import { CwtKit } from "../../classes/CwtKit.js";
import { Tag, decodeCbor, encodeCbor } from "../cose/cbor.js";
import { decodeProtectedHeader, encodeProtectedHeader } from "../cose/structures.js";
import { parseToken } from "../utils/parse-token.js";
import { COSE_TOKEN_WIRE } from "./cose-token-wire.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

/**
 * The COSE wire's KEYLESS claims read — the `aegis.parse` half of the CWT envelope
 * gates, and the twin of `jose-token-wire.test.ts`.
 *
 * A keyless parse checks no signature but still refuses a malformed ENVELOPE,
 * because everything downstream reads the result as a CWT (RFC 9052 §3.1). A rule
 * honoured on one encoding and skipped on the other is a rule an attacker chooses
 * to be bound by, since the encoding is the issuer's choice.
 *
 * ⚠ `assert-wire-typ.test.ts` pins the PREDICATE against configs it declares
 * itself, so it stays green over a call site that never runs it. This drives the
 * real wire.
 */
describe("COSE_TOKEN_WIRE keyless read gates", () => {
  const kit = new CwtKit({ logger: createMockLogger(), kryptos: TEST_EC_KEY_SIG });

  /**
   * A real CWT with its PROTECTED bucket rewritten — a sign floor would never emit
   * one, and the broken signature is irrelevant to a keyless read.
   *
   * ⚠ The labels are spelled as RFC 9052 §3.1 numbers rather than read off the
   * registry the wire itself reads, so the test states the WIRE and not the
   * package's opinion of it.
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

  // Label 16 is `typ` (RFC 9596 §4.1); the value names a JOSE encryption media type,
  // which no COSE claims reader can honour.
  const evilTyp = (): string =>
    rewritten((header) => header.set(16, "application/evil+jwe"));

  // Label 2 is `crit` (RFC 9052 §3.1), naming a parameter the header does not carry.
  const unknownCrit = (): string => rewritten((header) => header.set(2, ["fake-param"]));

  test("the keyless wire read refuses a foreign typ in its OWN words", () => {
    expect(refusalOf(() => COSE_TOKEN_WIRE.decodeClaims(evilTyp()))).toMatchSnapshot();
  });

  test("the keyless wire read refuses an unresolvable crit", () => {
    expect(
      refusalOf(() => COSE_TOKEN_WIRE.decodeClaims(unknownCrit())),
    ).toMatchSnapshot();
  });

  // `crit`'s members are LABELS, and the integer 7 is not the text label "7"
  // (RFC 9052 §1.5, RFC 9052 §3.1) — the keyless read judges them on the raw map,
  // where the two are still apart (`internal/header/assert-cose-crit-carried.ts`).
  test("the keyless wire read refuses a crit member carried under the OTHER label form", () => {
    expect(
      refusalOf(() =>
        COSE_TOKEN_WIRE.decodeClaims(
          rewritten((header) => {
            header.set(2, [7]);
            header.set("7", "v");
          }),
        ),
      ),
    ).toMatchSnapshot();
  });

  // The converse direction, so the rule is not "an integer member is special".
  test("the keyless wire read refuses a TEXT crit member carried at the integer label", () => {
    expect(
      refusalOf(() =>
        COSE_TOKEN_WIRE.decodeClaims(
          rewritten((header) => {
            header.set(2, ["7"]);
            header.set(7, "v");
          }),
        ),
      ),
    ).toMatchObject({ code: "cwt_invalid_crit" });
  });

  test("the keyless wire read accepts a crit member the SAME label form carries", () => {
    const token = rewritten((header) => {
      header.set(2, [7]);
      header.set(7, "v");
    });

    expect(COSE_TOKEN_WIRE.decodeClaims(token).protectedHeader.crit).toEqual(["7"]);
  });

  test("both refusals reach an aegis.parse caller unchanged", () => {
    // `parseToken` IS `aegis.parse`; the wire is the only thing that answers it.
    expect(refusalOf(() => parseToken(evilTyp()))).toMatchSnapshot();
    expect(refusalOf(() => parseToken(unknownCrit()))).toMatchSnapshot();
  });

  /**
   * ⚠ THE COSE_Mac0 HALF. `coseFormatOf` resolves `cwm` on this path, and every
   * other case in this file signs with an EC key — so without these rows the two
   * titles could be hardcoded to "CWT" with the suite still green.
   */
  describe("the same gates, under the COSE_Mac0 tag", () => {
    const macKit = new CwmKit({ logger: createMockLogger(), kryptos: TEST_OCT_KEY_SIG });

    const macRewritten = (
      edit: (header: Map<number | string, unknown>) => void,
    ): string => {
      const tags: Array<number> = [];
      let value: unknown = decodeCbor(macKit.sign({ iss: "https://test.lindorm.io/" }));

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

    test("a foreign typ on a COSE_Mac0 is refused as a CWM", () => {
      expect(
        refusalOf(() =>
          COSE_TOKEN_WIRE.decodeClaims(
            macRewritten((header) => header.set(16, "application/evil+jwe")),
          ),
        ),
      ).toMatchSnapshot();
    });

    test("an unresolvable crit on a COSE_Mac0 is refused as a CWM", () => {
      expect(
        refusalOf(() =>
          COSE_TOKEN_WIRE.decodeClaims(
            macRewritten((header) => header.set(2, ["fake-param"])),
          ),
        ),
      ).toMatchSnapshot();
    });
  });

  test("⚠ the parse-side and verify-side typ wordings DIFFER, deliberately", () => {
    // ⛔ NOT a copy-paste slip — do not collapse them. The word is the operation the
    // caller asked for: telling a parse caller their token cannot be VERIFIED would
    // name a check that path never runs.
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
