import { describe, expect, test } from "vitest";
import { CweError } from "../../errors/index.js";
import { Tag, encodeCbor } from "./cbor.js";
import { splitEncrypt0 } from "./split-encrypt0.js";
import { COSE_TAG } from "./structures.js";

const PROTECTED = Buffer.from([0xa1, 0x01, 0x03]);
const CIPHERTEXT = Buffer.from("ciphertext-with-tag", "utf8");

const unprotected = (): Map<number, unknown> =>
  new Map<number, unknown>([[5, Buffer.from("iv", "utf8")]]);

const encrypt0 = (
  contents: Array<unknown> = [PROTECTED, unprotected(), CIPHERTEXT],
): Buffer => encodeCbor(new Tag(COSE_TAG.encrypt0, contents));

describe("splitEncrypt0", () => {
  test("returns the three COSE_Encrypt0 segments", () => {
    const segments = splitEncrypt0(encrypt0());

    expect(Buffer.from(segments.protectedBstr)).toEqual(PROTECTED);
    expect(Buffer.from(segments.coseCiphertext as Uint8Array)).toEqual(CIPHERTEXT);
    expect(segments.unprotected).toBeInstanceOf(Map);
  });

  test("strips the outer CWT tag (61)", () => {
    // aegis envelopes what it emits; a foreign COSE_Encrypt0 arrives bare, and
    // `decrypt` and `decode` share this one opening.
    const tagged = encodeCbor(
      new Tag(
        COSE_TAG.cwt,
        new Tag(COSE_TAG.encrypt0, [PROTECTED, unprotected(), CIPHERTEXT]),
      ),
    );

    expect(Buffer.from(splitEncrypt0(tagged).coseCiphertext as Uint8Array)).toEqual(
      CIPHERTEXT,
    );
  });

  test("reads a BARE, untagged 3-element array", () => {
    const bare = encodeCbor([PROTECTED, unprotected(), CIPHERTEXT]);

    expect(Buffer.from(splitEncrypt0(bare).protectedBstr)).toEqual(PROTECTED);
  });

  test("refuses a COSE_Sign1 read as a COSE_Encrypt0", () => {
    const sign1 = encodeCbor(
      new Tag(COSE_TAG.sign1, [PROTECTED, unprotected(), CIPHERTEXT]),
    );

    expect(() => splitEncrypt0(sign1)).toThrow(
      expect.objectContaining({ code: "cose_malformed" }),
    );
  });

  test("refuses a structure of the wrong arity", () => {
    const four = encodeCbor(
      new Tag(COSE_TAG.encrypt0, [PROTECTED, unprotected(), CIPHERTEXT, CIPHERTEXT]),
    );

    expect(() => splitEncrypt0(four)).toThrow(CweError);
  });

  test("the refusal names the COSE_Encrypt0 shape", () => {
    let thrown: { code?: string; title?: string; details?: string } = {};

    try {
      splitEncrypt0(encodeCbor("not a cose structure"));
    } catch (error) {
      thrown = error as typeof thrown;
    }

    expect({
      code: thrown.code,
      title: thrown.title,
      details: thrown.details,
    }).toMatchSnapshot();
  });

  // RFC 9052 §3. This gate is the only one that judges the slot's own TYPE —
  // `decodeProtectedHeader` (`structures.ts`) judges the CBOR INSIDE a byte string
  // — so it is what keeps a non-bstr slot 0 inside the `AegisError` contract.
  //
  // ⚠ The `details` assertion is what separates this refusal from the ARITY one:
  // both are `cose_malformed`, so a code-only row stays green while the caller is
  // told its 3-element structure must be a 3-element array.
  test.each([
    ["nil", null],
    ["an int", 42],
    ["a tstr", "not bytes"],
    ["a map", new Map<number, unknown>([[1, 3]])],
  ])(
    "refuses %s protected header with the structural cose_malformed code",
    (_, value) => {
      let thrown: unknown;

      try {
        splitEncrypt0(encrypt0([value, unprotected(), CIPHERTEXT]));
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(CweError);
      expect((thrown as CweError).code).toBe("cose_malformed");
      expect((thrown as CweError).details).toBe(
        "The COSE_Encrypt0 protected header slot is not a byte string, so its parameters cannot be read.",
      );
    },
  );

  // ⚠ This splitter hands the protected byte string on RAW: only `CweKit.decode`
  // and `CweKit.decrypt` decode it, so the inner `bstr .cbor header_map` half of
  // RFC 9052 §3 is gated there (`decodeProtectedHeader`, `structures.ts`) and
  // pinned by `CweKit.test.ts`, not here.
  test("an EMPTY protected header reads — a zero-length bstr is a bstr", () => {
    // RFC 9052 §3. `encodeProtectedHeader` emits exactly this for a header map
    // with no parameters, so a non-empty check would refuse aegis's own output.
    const empty = encrypt0([Buffer.alloc(0), unprotected(), CIPHERTEXT]);

    expect(splitEncrypt0(empty).protectedBstr).toHaveLength(0);
  });

  test("does NOT require a ciphertext — a nil one is legal COSE", () => {
    // ⚠ RFC 9052 §5.2. `CweKit.decode` is a header-only read, so folding the
    // ciphertext gate in here turns a detached-ciphertext token it must keep
    // reading into a refused one. `CweKit.decrypt` owns that gate.
    const detached = encrypt0([PROTECTED, unprotected(), null]);

    expect(splitEncrypt0(detached).coseCiphertext).toBeNull();
  });

  test("does NOT require an IV — that gate belongs to `decrypt` alone", () => {
    // ⚠ `CweKit.decode` is a header-only read that accepts a COSE_Encrypt0 with no
    // IV, so folding the IV check in here turns a readable token into a refused one.
    const noIv = encodeCbor(
      new Tag(COSE_TAG.encrypt0, [PROTECTED, new Map<number, unknown>(), CIPHERTEXT]),
    );

    expect(() => splitEncrypt0(noIv)).not.toThrow();
  });
});
