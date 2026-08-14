import { describe, expect, test } from "vitest";
import { CoseError, CwsError } from "../../errors/index.js";
import { requireSignature } from "./require-signature.js";

const words = {
  error: CwsError,
  message: "Malformed COSE_Sign1",
  title: "Malformed COSE_Sign1",
  details: "The COSE_Sign1 has a nil signature, so there is nothing to verify.",
};

describe("requireSignature", () => {
  test("returns the signature bytes as a Buffer when one is present", () => {
    const bytes = requireSignature(Uint8Array.from([7, 8, 9]), words);

    expect(Buffer.isBuffer(bytes)).toBe(true);
    expect(bytes.equals(Buffer.from([7, 8, 9]))).toBe(true);
  });

  // A zero-length signature is PRESENT — the producer put a byte string there,
  // and it happens to hold no bytes. It verifies against nothing, but that is the
  // signature cycle's verdict to give; only `null`/absent means the slot is empty,
  // and conflating the two is exactly the lie the old `Buffer.alloc(0)` fallback
  // in the CWT decode told.
  test("accepts an EMPTY signature — present is not the same as non-empty", () => {
    expect(requireSignature(Uint8Array.from([]), words)).toHaveLength(0);
  });

  test("refuses a NIL signature with the structural cose_malformed code", () => {
    let thrown: unknown;

    try {
      requireSignature(null, words);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(CwsError);
    expect((thrown as CwsError).code).toBe("cose_malformed");
    expect((thrown as CwsError).message).toBe("Malformed COSE_Sign1");
  });

  test("refuses an ABSENT signature the same way", () => {
    expect(() => requireSignature(undefined, words)).toThrow(CwsError);
  });

  // The words — and the leaf error class — are DATA, so each read path names the
  // structure it expected in its own terms while the code stays one value.
  test("throws under the leaf class the call site names", () => {
    let thrown: unknown;

    try {
      requireSignature(null, { ...words, error: CoseError, message: "Malformed CWT" });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(CoseError);
    expect(thrown).not.toBeInstanceOf(CwsError);
    expect((thrown as CoseError).code).toBe("cose_malformed");
  });
});
