import { describe, expect, test } from "vitest";
import { CoseError, CwsError } from "../../errors/index.js";
import { requireBstr } from "./require-bstr.js";

const words = {
  error: CwsError,
  message: "Malformed COSE_Sign1",
  title: "Malformed COSE_Sign1",
  details:
    "The COSE_Sign1 payload slot is not a byte string, so there is no content to read.",
};

describe("requireBstr", () => {
  test("returns the slot bytes as a Buffer", () => {
    const bytes = requireBstr(Uint8Array.from([1, 2, 3]), words);

    expect(Buffer.isBuffer(bytes)).toBe(true);
    expect(bytes.equals(Buffer.from([1, 2, 3]))).toBe(true);
  });

  // ⚠ An EMPTY byte string is a byte string. `encodeProtectedHeader` emits
  // exactly this for a header map with no parameters (`structures.ts`), and an
  // attached payload or a present signature holding no bytes is equally legal —
  // a `Buffer.alloc(0)` fallback would conflate that with an absent slot.
  test("accepts a ZERO-LENGTH byte string — a bstr is not required to be non-empty", () => {
    expect(requireBstr(Uint8Array.from([]), words)).toHaveLength(0);
  });

  test("refuses a NIL slot with the structural cose_malformed code", () => {
    let thrown: unknown;

    try {
      requireBstr(null, words);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(CwsError);
    expect((thrown as CwsError).code).toBe("cose_malformed");
    expect((thrown as CwsError).message).toBe("Malformed COSE_Sign1");
  });

  test("refuses an ABSENT slot the same way", () => {
    expect(() => requireBstr(undefined, words)).toThrow(CwsError);
  });

  // The slot types a producer can put on the wire that are NOT a bstr. `Buffer.from`
  // reaches a raw `TypeError` on the number and returns fabricated UTF-8 bytes on the
  // string, so a type check is the only thing that keeps either inside the contract.
  test.each([
    ["an int", 42],
    ["a tstr", "not bytes"],
    ["a map", new Map<number, unknown>([[1, -7]])],
    ["an array", [1, 2, 3]],
    ["a bool", true],
  ])("refuses %s slot with the structural cose_malformed code", (_, value) => {
    let thrown: unknown;

    try {
      requireBstr(value, words);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(CwsError);
    expect((thrown as CwsError).code).toBe("cose_malformed");
  });

  // The words and the leaf error class are DATA, so each read path names the
  // structure it expected while the code stays one value.
  test("throws under the leaf class the call site names", () => {
    let thrown: unknown;

    try {
      requireBstr(null, { ...words, error: CoseError, message: "Malformed CWT" });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(CoseError);
    expect(thrown).not.toBeInstanceOf(CwsError);
    expect((thrown as CoseError).code).toBe("cose_malformed");
  });
});
