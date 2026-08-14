import { describe, expect, test } from "vitest";
import { CoseError, CwsError } from "../../errors/index.js";
import { requireAttachedPayload } from "./require-attached-payload.js";

const words = {
  error: CwsError,
  message: "Malformed COSE_Sign1",
  title: "Malformed COSE_Sign1",
  details:
    "The COSE_Sign1 has a detached or nil payload, so there is no content to read.",
};

describe("requireAttachedPayload", () => {
  test("returns the payload bytes as a Buffer when one is attached", () => {
    const bytes = requireAttachedPayload(Uint8Array.from([1, 2, 3]), words);

    expect(Buffer.isBuffer(bytes)).toBe(true);
    expect(bytes.equals(Buffer.from([1, 2, 3]))).toBe(true);
  });

  // An EMPTY payload is attached — the producer said "these bytes", and there
  // happen to be none of them. Only `null`/absent means detached, so an empty
  // byte string must pass through rather than be read as a missing payload.
  test("accepts an EMPTY payload — attached is not the same as non-empty", () => {
    expect(requireAttachedPayload(Uint8Array.from([]), words)).toHaveLength(0);
  });

  test("refuses a DETACHED (nil) payload with the structural cose_malformed code", () => {
    let thrown: unknown;

    try {
      requireAttachedPayload(null, words);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(CwsError);
    expect((thrown as CwsError).code).toBe("cose_malformed");
    expect((thrown as CwsError).message).toBe("Malformed COSE_Sign1");
  });

  test("refuses an ABSENT payload the same way", () => {
    expect(() => requireAttachedPayload(undefined, words)).toThrow(CwsError);
  });

  // The words — and the leaf error class — are DATA, so each read path names the
  // structure it expected in its own terms while the code stays one value.
  test("throws under the leaf class the call site names", () => {
    let thrown: unknown;

    try {
      requireAttachedPayload(null, {
        ...words,
        error: CoseError,
        message: "Malformed CWT",
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(CoseError);
    expect(thrown).not.toBeInstanceOf(CwsError);
    expect((thrown as CoseError).code).toBe("cose_malformed");
  });
});
