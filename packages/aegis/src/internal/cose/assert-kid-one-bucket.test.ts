import { describe, expect, test } from "vitest";
import { CoseError, CwsError } from "../../errors/index.js";
import { coseByJose } from "../header/header-registry.js";
import { assertKidOneBucket } from "./assert-kid-one-bucket.js";
import type { CoseLabel } from "./cose-label.js";

const KID = coseByJose("kid");

const bucket = (entries: Array<[CoseLabel, unknown]> = []): Map<CoseLabel, unknown> =>
  new Map(entries);

const id = Buffer.from("key-1", "utf8");

describe("assertKidOneBucket", () => {
  test("accepts a key identifier stated in the protected bucket alone", () => {
    expect(() =>
      assertKidOneBucket({
        protectedMap: bucket([[KID, id]]),
        unprotected: bucket(),
        error: CoseError,
      }),
    ).not.toThrow();
  });

  test("accepts a key identifier stated in the unprotected bucket alone", () => {
    expect(() =>
      assertKidOneBucket({
        protectedMap: bucket(),
        unprotected: bucket([[KID, id]]),
        error: CoseError,
      }),
    ).not.toThrow();
  });

  test("accepts a token that states no key identifier at all", () => {
    expect(() =>
      assertKidOneBucket({
        protectedMap: bucket(),
        unprotected: bucket(),
        error: CoseError,
      }),
    ).not.toThrow();
  });

  // ⚠ The unprotected slot arrives AS CBOR DECODED IT, and this guard runs before
  // anything is authenticated: a producer writes any type it likes there. A bucket
  // this reader cannot index states no `kid`, so the pair cannot collide — a cast
  // in place of the narrowing reaches `.has` as a raw `TypeError`.
  test.each([
    ["nil", null],
    ["absent", undefined],
    ["an int", 42],
    ["a tstr", "not a bucket"],
    ["an array", [KID]],
  ])(
    "accepts a protected key identifier where the unprotected slot is %s",
    (_name, unprotected) => {
      expect(() =>
        assertKidOneBucket({
          protectedMap: bucket([[KID, id]]),
          unprotected,
          error: CoseError,
        }),
      ).not.toThrow();
    },
  );

  test("refuses the same key identifier stated in both buckets, naming the parameter", () => {
    let thrown: unknown;

    try {
      assertKidOneBucket({
        protectedMap: bucket([[KID, id]]),
        unprotected: bucket([[KID, id]]),
        error: CoseError,
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(CoseError);
    expect((thrown as CoseError).code).toBe("cose_duplicate_kid");
    expect((thrown as CoseError).data).toEqual({ parameter: "kid" });
  });

  test("refuses two key identifiers that differ", () => {
    expect(() =>
      assertKidOneBucket({
        protectedMap: bucket([[KID, id]]),
        unprotected: bucket([[KID, Buffer.from("key-2", "utf8")]]),
        error: CoseError,
      }),
    ).toThrow(CoseError);
  });

  // The LABEL is the question. A value of the wrong type is a `kid` a reader cannot
  // use, not a `kid` the producer did not state (RFC 9052 §3.1).
  test("refuses the collision whatever type the two values carry", () => {
    expect(() =>
      assertKidOneBucket({
        protectedMap: bucket([[KID, 42]]),
        unprotected: bucket([[KID, id]]),
        error: CoseError,
      }),
    ).toThrow(CoseError);
  });

  // The leaf class is DATA, so each read path refuses under its own namespace
  // while the code stays one value (`error-by-format.ts`).
  test("throws under the leaf class the call site names", () => {
    let thrown: unknown;

    try {
      assertKidOneBucket({
        protectedMap: bucket([[KID, id]]),
        unprotected: bucket([[KID, id]]),
        error: CwsError,
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(CwsError);
    expect((thrown as CwsError).code).toBe("cose_duplicate_kid");
  });
});
