import { describe, expect, test } from "vitest";
import { CoseError, CwsError } from "../../errors/index.js";
import { Tag, encodeCbor } from "./cbor.js";
import { splitSigned } from "./split-signed.js";
import { COSE_TAG, encodeProtectedHeader } from "./structures.js";

const PROTECTED = encodeProtectedHeader(
  new Map<number, unknown>([
    [1, -7],
    [3, "application/json"],
  ]),
);
const PAYLOAD = Buffer.from("payload-bytes", "utf8");
const SIGNATURE = Buffer.from("signature-bytes", "utf8");

const unprotected = (): Map<number, unknown> =>
  new Map<number, unknown>([[4, Buffer.from("key_test", "utf8")]]);

const sign1 = (
  contents: Array<unknown> = [PROTECTED, unprotected(), PAYLOAD, SIGNATURE],
) => encodeCbor(new Tag(COSE_TAG.sign1, contents));

const OPTIONS = {
  arity: { exactly: 4 } as const,
  tags: [COSE_TAG.sign1, COSE_TAG.mac0],
  error: CwsError,
  message: "Malformed COSE structure",
  title: "Malformed COSE Structure",
  arityDetails: "A COSE_Sign1/COSE_Mac0 must be a 4-element array.",
  protectedDetails:
    "The COSE_Sign1/COSE_Mac0 protected header slot is not a byte string.",
};

describe("splitSigned", () => {
  test("returns the four segments beside both translated header buckets", () => {
    const segments = splitSigned(sign1(), OPTIONS);

    expect(Buffer.from(segments.protectedBstr)).toEqual(PROTECTED);
    expect(Buffer.from(segments.payload as Uint8Array)).toEqual(PAYLOAD);
    expect(Buffer.from(segments.signature as Uint8Array)).toEqual(SIGNATURE);
    expect(segments.protectedHeader).toEqual({ alg: "ES256", cty: "application/json" });
    expect(segments.unprotectedHeader).toEqual({ kid: "key_test" });
  });

  test("⚠ the two buckets stay SEPARATE — neither leaks into the other", () => {
    // No signature covers an unprotected parameter, so merging the buckets makes
    // an attacker-supplied `typ` indistinguishable from a signed one.
    const spoofed = new Map<number, unknown>([
      [4, Buffer.from("key_test", "utf8")],
      [16, "application/spoofed+cwt"],
    ]);

    const segments = splitSigned(
      sign1([PROTECTED, spoofed, PAYLOAD, SIGNATURE]),
      OPTIONS,
    );

    expect(segments.protectedHeader.typ).toBeUndefined();
    expect(segments.unprotectedHeader.typ).toBe("application/spoofed+cwt");
  });

  test("strips the outer CWT tag (61)", () => {
    // aegis envelopes what it emits; a foreign COSE_Sign1 arrives bare, and both
    // must read through this one opening.
    const tagged = encodeCbor(
      new Tag(
        COSE_TAG.cwt,
        new Tag(COSE_TAG.sign1, [PROTECTED, unprotected(), PAYLOAD, SIGNATURE]),
      ),
    );

    expect(Buffer.from(splitSigned(tagged, OPTIONS).payload as Uint8Array)).toEqual(
      PAYLOAD,
    );
  });

  test("reads a BARE, untagged array", () => {
    const bare = encodeCbor([PROTECTED, unprotected(), PAYLOAD, SIGNATURE]);

    expect(Buffer.from(splitSigned(bare, OPTIONS).protectedBstr)).toEqual(PROTECTED);
  });

  test("a COSE_Mac0 reads through the same opening", () => {
    const mac0 = encodeCbor(
      new Tag(COSE_TAG.mac0, [PROTECTED, unprotected(), PAYLOAD, SIGNATURE]),
    );

    expect(splitSigned(mac0, OPTIONS).unprotectedHeader.kid).toBe("key_test");
  });

  test("refuses a structure whose tag is not among the accepted ones", () => {
    const encrypt0 = encodeCbor(
      new Tag(COSE_TAG.encrypt0, [PROTECTED, unprotected(), PAYLOAD, SIGNATURE]),
    );

    expect(() => splitSigned(encrypt0, OPTIONS)).toThrow(
      expect.objectContaining({ code: "cose_malformed" }),
    );
  });

  test("refuses a structure of the wrong arity, under the caller's leaf class", () => {
    const three = encodeCbor(
      new Tag(COSE_TAG.sign1, [PROTECTED, unprotected(), PAYLOAD]),
    );

    expect(() => splitSigned(three, OPTIONS)).toThrow(CwsError);

    expect(() =>
      splitSigned(three, { ...OPTIONS, error: CoseError, tags: undefined }),
    ).toThrow(CoseError);
  });

  test("an `atLeast` arity admits the longer structure the claims decode reads", () => {
    // `decodeCwtWire` asks for at least 3 and takes the tag list off, so a bare
    // CWT another producer framed differently still reads.
    const three = encodeCbor([PROTECTED, unprotected(), PAYLOAD]);

    const segments = splitSigned(three, {
      ...OPTIONS,
      arity: { atLeast: 3 },
      tags: undefined,
    });

    expect(segments.signature).toBeUndefined();
    expect(Buffer.from(segments.payload as Uint8Array)).toEqual(PAYLOAD);
  });

  test("reports a DETACHED (nil) payload as null rather than refusing it", () => {
    // A detached payload is legal COSE and the verdict belongs to the caller, so
    // this hands it back untouched.
    const detached = sign1([PROTECTED, unprotected(), null, SIGNATURE]);

    expect(splitSigned(detached, OPTIONS).payload).toBeNull();
  });

  test("an EMPTY protected header translates to an empty bucket, not a throw", () => {
    // RFC 9052 §3.
    const empty = sign1([Buffer.alloc(0), unprotected(), PAYLOAD, SIGNATURE]);

    expect(splitSigned(empty, OPTIONS).protectedHeader).toEqual({});
  });

  test("an unprotected bucket that is not a map reads as EMPTY, not as a crash", () => {
    const notAMap = sign1([PROTECTED, "not a map", PAYLOAD, SIGNATURE]);

    expect(splitSigned(notAMap, OPTIONS).unprotectedHeader).toEqual({});
  });

  // RFC 9052 §3. This gate is the only one that judges the slot's own TYPE —
  // `decodeProtectedHeader` (`structures.ts`) judges the CBOR INSIDE a byte string
  // — so it is what keeps a non-bstr slot 0 inside the `AegisError` contract a
  // caller branches on to answer 401 rather than 500.
  //
  // ⚠ The `details` assertion is what separates this refusal from the ARITY one:
  // both are `cose_malformed`, so a code-only row stays green while the caller is
  // told its 4-element structure must be a 4-element array.
  test.each([
    ["nil", null],
    ["an int", 42],
    ["a tstr", "not bytes"],
    ["a map", new Map<number, unknown>([[1, -7]])],
  ])("refuses %s protected header under the caller's leaf class", (_, value) => {
    const spliced = sign1([value, unprotected(), PAYLOAD, SIGNATURE]);

    let thrown: unknown;

    try {
      splitSigned(spliced, OPTIONS);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(CwsError);
    expect((thrown as CwsError).code).toBe("cose_malformed");
    expect((thrown as CwsError).details).toBe(OPTIONS.protectedDetails);
  });

  // The protected bucket is `bstr .cbor header_map` (RFC 9052 §3), and `requireBstr`
  // reaches only the outer `bstr`. `decodeProtectedHeader` (`structures.ts`) is
  // where the inner half is enforced, which is why all four rows answer under
  // `CoseError` rather than the caller's leaf class.
  test.each([
    ["an int", encodeCbor(42)],
    ["an array", encodeCbor([1, 2])],
    ["nil", encodeCbor(null)],
    ["a tstr", encodeCbor("hi")],
  ])("refuses a protected byte string holding %s", (_, bstr) => {
    let thrown: unknown;

    try {
      splitSigned(sign1([bstr, unprotected(), PAYLOAD, SIGNATURE]), OPTIONS);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(CoseError);
    expect((thrown as CoseError).code).toBe("cose_malformed");
  });

  test("the refusal carries the caller's words under the shared code", () => {
    let thrown: { code?: string; title?: string; details?: string } = {};

    try {
      splitSigned(encodeCbor("not a cose structure"), OPTIONS);
    } catch (error) {
      thrown = error as typeof thrown;
    }

    expect({
      code: thrown.code,
      title: thrown.title,
      details: thrown.details,
    }).toMatchSnapshot();
  });
});
