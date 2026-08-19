import { Amphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { Dict } from "@lindorm/types";
import MockDate from "mockdate";
import { beforeAll, describe, expect, test } from "vitest";
import {
  type CoseInspection,
  type RawLabelMap,
  inspectToken,
} from "../__fixtures__/inspect-token.js";
import { TEST_EC_KEY_SIG, TEST_OCT_KEY_ENC } from "../__fixtures__/keys.js";
import { Aegis } from "./Aegis.js";
import { CweKit } from "./CweKit.js";
import { CwsKit } from "./CwsKit.js";
import { CwtKit } from "./CwtKit.js";

/**
 * THE INTEROPERABLE DEFAULT REACHES THE HEADER, NOT ONLY THE CLAIMS.
 *
 * `oid` (the lindorm object id) has no IANA COSE header parameter, so it rides
 * the COSE wire under a lindorm PRIVATE-USE label. RFC 8152 §16.2 — the registry
 * RFC 9052 §11.1 re-points — reserves that whole range to whoever squats it:
 * *"Integer values less than -65536 are marked as private use."* An integer there
 * is therefore MEANINGLESS to any reader but us, and a token that carries one is
 * not interoperable, whatever it says about itself.
 *
 * `proprietary: false` — the default — is the promise that a token carries
 * nothing of the kind. The claims side has always kept it (a private-use claim
 * label degrades to its JOSE string key). The HEADER side did not: a caller's
 * `objectId` went onto every COSE wire at the integer `-70000` regardless, so the
 * default emitted exactly the artifact it promises to prevent.
 *
 * The repair is the spelling and ONLY the spelling. RFC 9052 §1.5 defines
 * `label = int / tstr`, so a text label is a legal COSE label: the interoperable
 * default writes the parameter's STRING label, the proprietary mode its compact
 * integer, and neither adds, drops or renames a parameter.
 *
 * ⚠ EVERY WIRE ASSERTION HERE GOES THROUGH THE INDEPENDENT INSPECTOR
 * (`__fixtures__/inspect-token.ts` — raw `cbor2`, importing nothing from
 * `src/internal/`). Reading a token back through aegis's own decoder would be
 * satisfied by a writer and a reader that agree on the wrong label, which is the
 * exact shape of the defect. And because CBOR keys the integer `4` and
 * the text `"4"` DIFFERENT labels, the inspector reports them apart — so the rows
 * below assert `has(-70000)` and `has("oid")` separately rather than comparing a
 * stringified key that would conflate them.
 */

// Inside the fixture keys' validity window — amphora refuses an expired key.
MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

const logger = createMockLogger();

const ISSUER = "https://test.lindorm.io/";
const OBJECT_ID = "oid_0000000000000000000000000";

/**
 * The lindorm private-use header label, written out rather than read from
 * `header-registry.ts`.
 *
 * ⛔ DO NOT replace this with `coseByJose("oid")` or `headerCoseLabel(...)`. A
 * test that derives its expected label from the registry agrees with whatever the
 * registry currently says — including the integer it said while this defect was
 * live — so it can state that the wire matches the registry but never that the
 * wire is interoperable.
 */
const OID_INTEGER_LABEL = -70000;

/** The `oid` parameter's interoperable TEXT label. Also written out, same reason. */
const OID_TEXT_LABEL = "oid";

/** RFC 9052 §3.1 Table 2 / RFC 9360 §2 — registered labels, for the contrast rows. */
const COSE_LABEL = { crit: 2, x5u: 35 } as const;

const CLAIMS: Dict = { iss: ISSUER, sub: "user-1" };
const CONTENT: Dict = { data: "opaque" };

/** A COSE token's two raw buckets, read by the independent inspector. */
const bucketsOf = (token: Buffer): CoseInspection => {
  const inspection = inspectToken(token.toString("base64url"));

  // A JOSE inspection here would mean the door under test stopped emitting COSE,
  // and every label assertion below would then read an empty map and pass.
  expect(inspection.wire).toBe("cose");

  return inspection as CoseInspection;
};

const protectedOf = (token: Buffer): RawLabelMap => bucketsOf(token).protectedHeader;

/**
 * The protected bucket as an ORDERED list of raw `[label, value]` pairs — the
 * comparable form, when two tokens have to be held against each other.
 *
 * ⚠ NOT the token bytes. ES512 draws a fresh ECDSA nonce and a COSE_Encrypt0 a
 * fresh IV, so two tokens over identical input never agree byte for byte — a
 * whole-token difference assertion would pass on randomness alone and a
 * whole-token equality assertion would fail on it. The header is the only part
 * of these tokens that is a function of the input, so it is the part compared.
 */
const protectedEntriesOf = (token: Buffer): Array<[number | string, unknown]> => [
  ...protectedOf(token).entries(),
];

/**
 * The three COSE write doors, each handed the SAME caller header bag in its own
 * vocabulary. They are separate merges over separate structures — a claims
 * COSE_Sign1, an opaque COSE_Sign1, a COSE_Encrypt0 — so a repair in one says
 * nothing about the other two.
 */
const DOORS = [
  {
    name: "CwtKit.sign (COSE_Sign1 over a CWT Claims Set)",
    write: (proprietary: boolean | undefined): Buffer =>
      new CwtKit({ kryptos: TEST_EC_KEY_SIG, logger }).sign(CLAIMS, {
        header: { oid: OBJECT_ID },
        proprietary,
      }),
    read: (token: Buffer): unknown =>
      new CwtKit({ kryptos: TEST_EC_KEY_SIG, logger }).verify(token).protectedHeader.oid,
  },
  {
    name: "CwsKit.sign (COSE_Sign1 over opaque content)",
    write: (proprietary: boolean | undefined): Buffer =>
      new CwsKit({ kryptos: TEST_EC_KEY_SIG, logger }).sign(CONTENT, {
        header: { oid: OBJECT_ID },
        proprietary,
      }),
    read: (token: Buffer): unknown =>
      new CwsKit({ kryptos: TEST_EC_KEY_SIG, logger }).verify(token).protectedHeader.oid,
  },
  {
    name: "CweKit.encrypt (COSE_Encrypt0)",
    write: (proprietary: boolean | undefined): Buffer =>
      new CweKit({ kryptos: TEST_OCT_KEY_ENC, logger }).encrypt(CONTENT, {
        header: { oid: OBJECT_ID },
        proprietary,
      }),
    read: (token: Buffer): unknown =>
      new CweKit({ kryptos: TEST_OCT_KEY_ENC, logger }).decrypt(token).protectedHeader
        .oid,
  },
] as const;

describe("a private-use COSE header label degrades to its interoperable spelling", () => {
  describe.each(DOORS)("$name", ({ write, read }) => {
    test("the DEFAULT writes the TEXT label, and no private-use integer", () => {
      const bucket = protectedOf(write(undefined));

      expect(bucket.get(OID_TEXT_LABEL)).toBe(OBJECT_ID);
      // The load-bearing half: the token carries nothing at the private-use
      // integer. Without it the row would pass on a writer that emitted BOTH.
      expect(bucket.has(OID_INTEGER_LABEL)).toBe(false);
    });

    test("an EXPLICIT `proprietary: false` is the same header as the default", () => {
      expect(protectedEntriesOf(write(false))).toEqual(
        protectedEntriesOf(write(undefined)),
      );
    });

    test("`proprietary: true` writes the compact private-use INTEGER instead", () => {
      const bucket = protectedOf(write(true));

      expect(bucket.get(OID_INTEGER_LABEL)).toBe(OBJECT_ID);
      expect(bucket.has(OID_TEXT_LABEL)).toBe(false);
    });

    test("the two modes are a real DIFFERENCE, not a knob that does nothing", () => {
      // Stated as a whole-bucket difference as well as label by label: a
      // forwarding seam that dropped the flag would leave both rows above
      // asserting the same single spelling, and one of them would simply be
      // deleted as wrong.
      expect(protectedEntriesOf(write(false))).not.toEqual(
        protectedEntriesOf(write(true)),
      );
    });

    test("BOTH spellings read back to the same domain value", () => {
      // The read side has to answer for either label or aegis cannot read the
      // token it just wrote — and a foreign reader handed the interoperable one
      // is in the same position.
      expect(read(write(false))).toBe(OBJECT_ID);
      expect(read(write(true))).toBe(OBJECT_ID);
    });
  });

  /**
   * The gate is the RANGE, not the name. `x5u` (RFC 9360 §2, label 35) is
   * REGISTERED, so its integer is already interoperable and there is no
   * text spelling for the mode to choose between — inventing one would be a
   * second name no specification gives the parameter.
   */
  describe("a REGISTERED label is untouched by the mode", () => {
    const withX5u = (proprietary: boolean): Buffer =>
      new CwtKit({ kryptos: TEST_EC_KEY_SIG, logger }).sign(CLAIMS, {
        header: { x5u: "https://issuer.lindorm.test/certs.pem" },
        proprietary,
      });

    test.each([false, true])("proprietary: %s keeps the integer label", (proprietary) => {
      const bucket = protectedOf(withX5u(proprietary));

      expect(bucket.get(COSE_LABEL.x5u)).toBe("https://issuer.lindorm.test/certs.pem");
      expect(bucket.has("x5u")).toBe(false);
    });

    test("so the two modes write an IDENTICAL header when no private-use label is in play", () => {
      expect(protectedEntriesOf(withX5u(false))).toEqual(
        protectedEntriesOf(withX5u(true)),
      );
    });
  });

  /**
   * RFC 9052 §3.1: *"if the crit value list includes a label for which the header
   * parameter is not in the protected-header-parameters bucket, this is a fatal
   * error in processing the message."* A `crit` naming `-70000` over a bucket
   * keyed `"oid"` IS that fatal error — the two are different labels — so the
   * members follow the parameters into whichever spelling the mode chose.
   *
   * ⚠ Wire-only BY DIVISION OF LABOUR, not because the reader refuses the
   * token. `oid` is the header registry's one `critEligible` parameter, so
   * aegis's own reader ACCEPTS this token in both interop modes — pinned in
   * `CwtKit.test.ts#verify accepts the crit extension aegis implements` and in
   * the conformance table's
   * `a-producer-may-mark-an-implemented-extension-parameter-critical`. What is
   * stated HERE is the thing a round trip cannot state: aegis reading back its
   * own bytes proves the writer and the reader agree, not that either is right,
   * and the label/name confusion this file exists for round-tripped perfectly
   * while being fatally malformed. So this reads the RAW bytes and asserts what
   * a conformant third party would find.
   */
  describe("crit's members are spelled the same way as the parameters they name", () => {
    const withCrit = (proprietary: boolean): RawLabelMap =>
      protectedOf(
        new CwtKit({ kryptos: TEST_EC_KEY_SIG, logger }).sign(CLAIMS, {
          header: { crit: ["oid"], oid: OBJECT_ID },
          proprietary,
        }),
      );

    test("the interoperable default names the TEXT label it wrote", () => {
      const bucket = withCrit(false);

      expect(bucket.get(COSE_LABEL.crit)).toEqual([OID_TEXT_LABEL]);
      expect(bucket.has(OID_TEXT_LABEL)).toBe(true);
    });

    test("proprietary names the INTEGER label it wrote", () => {
      const bucket = withCrit(true);

      expect(bucket.get(COSE_LABEL.crit)).toEqual([OID_INTEGER_LABEL]);
      expect(bucket.has(OID_INTEGER_LABEL)).toBe(true);
    });
  });

  /**
   * The kits are where the labels are written, but nothing a caller reaches for
   * is a kit. These rows come in through the PUBLIC domain verbs, in the DOMAIN
   * vocabulary (`objectId`, not `oid`), because the forwarding seam between the
   * two is its own opportunity to drop the flag.
   */
  describe("through the public domain surface", () => {
    let aegis: Aegis;

    beforeAll(async () => {
      const amphora = new Amphora({ internal: { issuer: ISSUER }, logger });
      await amphora.setup();
      amphora.add(TEST_EC_KEY_SIG);
      amphora.add(TEST_OCT_KEY_ENC);
      aegis = new Aegis({ amphora, logger });
    });

    // The OPAQUE COSE namespace. It takes the kits' own wire-named bag, so the
    // parameter is spelled `oid` here rather than `objectId` — `aegis.cws.sign`
    // runs no domain→wire header translation. It has a `proprietary` knob like
    // every kit door; this row states what the DEFAULT emits.
    test("cws.sign emits the interoperable spelling on the COSE wire", async () => {
      const { token } = await aegis.cws.sign(CONTENT, {
        header: { oid: OBJECT_ID },
      });
      const bucket = protectedOf(Buffer.from(token, "base64url"));

      expect(bucket.get(OID_TEXT_LABEL)).toBe(OBJECT_ID);
      expect(bucket.has(OID_INTEGER_LABEL)).toBe(false);

      // …and the domain reader still reports the domain name, which is the whole
      // point of degrading the spelling rather than dropping the parameter.
      expect((await aegis.verify(token)).header.objectId).toBe(OBJECT_ID);
    });

    const minted = async (proprietary: boolean | undefined): Promise<string> => {
      const { token } = await aegis.mint(
        "default",
        { subject: "user-1", expires: "1h" } as never,
        {
          format: "cwt",
          proprietary,
          sign: { key: { kryptos: TEST_EC_KEY_SIG }, header: { objectId: OBJECT_ID } },
        } as never,
      );

      return token;
    };

    test("aegis.mint defaults to the interoperable spelling on the COSE wire", async () => {
      const token = await minted(undefined);
      const bucket = protectedOf(Buffer.from(token, "base64url"));

      expect(bucket.get(OID_TEXT_LABEL)).toBe(OBJECT_ID);
      expect(bucket.has(OID_INTEGER_LABEL)).toBe(false);
      expect(aegis.parse(token).header.objectId).toBe(OBJECT_ID);
    });

    test("aegis.mint honours proprietary on the COSE wire", async () => {
      const token = await minted(true);
      const bucket = protectedOf(Buffer.from(token, "base64url"));

      expect(bucket.get(OID_INTEGER_LABEL)).toBe(OBJECT_ID);
      expect(bucket.has(OID_TEXT_LABEL)).toBe(false);
      expect(aegis.parse(token).header.objectId).toBe(OBJECT_ID);
    });

    test("aegis.encrypt defaults to the interoperable spelling on the COSE wire", async () => {
      const { token } = await aegis.encrypt(CONTENT, {
        format: "cwe",
        header: { objectId: OBJECT_ID },
      });
      const bucket = protectedOf(Buffer.from(token, "base64url"));

      expect(bucket.get(OID_TEXT_LABEL)).toBe(OBJECT_ID);
      expect(bucket.has(OID_INTEGER_LABEL)).toBe(false);
      expect((await aegis.decrypt(token)).header.objectId).toBe(OBJECT_ID);
    });

    test("aegis.encrypt honours proprietary on the COSE wire", async () => {
      const { token } = await aegis.encrypt(CONTENT, {
        format: "cwe",
        header: { objectId: OBJECT_ID },
        proprietary: true,
      });
      const bucket = protectedOf(Buffer.from(token, "base64url"));

      expect(bucket.get(OID_INTEGER_LABEL)).toBe(OBJECT_ID);
      expect(bucket.has(OID_TEXT_LABEL)).toBe(false);
      expect((await aegis.decrypt(token)).header.objectId).toBe(OBJECT_ID);
    });

    // The JOSE wire has ONE spelling for every parameter (RFC 7515 §4.1 — names,
    // not labels), so the mode has nothing to choose there. A degrade that leaked
    // onto it would be inventing a second JOSE header name.
    test("the JOSE wire is untouched by the mode", async () => {
      const jose = async (proprietary: boolean): Promise<Dict> => {
        const { token } = await aegis.mint(
          "default",
          { subject: "user-1", expires: "1h" } as never,
          {
            format: "jwt",
            proprietary,
            sign: { key: { kryptos: TEST_EC_KEY_SIG }, header: { objectId: OBJECT_ID } },
          } as never,
        );
        const inspection = inspectToken(token);
        expect(inspection.wire).toBe("jose");
        return inspection.protectedHeader;
      };

      expect((await jose(false)).oid).toBe(OBJECT_ID);
      expect(await jose(false)).toEqual(await jose(true));
    });
  });
});
