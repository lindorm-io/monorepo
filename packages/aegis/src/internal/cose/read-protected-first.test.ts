import { describe, expect, test } from "vitest";
import { coseByJose } from "../header/header-registry.js";
import type { CoseLabel } from "./cose-label.js";
import { readProtectedFirst } from "./read-protected-first.js";

const KID = coseByJose("kid");

const bucket = (entries: Array<[CoseLabel, unknown]> = []): Map<CoseLabel, unknown> =>
  new Map(entries);

const OTHER = Buffer.from("other-key", "utf8");

describe("readProtectedFirst", () => {
  test.each([
    ["a text byte string", Buffer.from("key-1", "utf8")],
    ["the CBOR null", null],
    ["the CBOR undefined", undefined],
  ])(
    "answers %s stated in the protected bucket, never the unprotected value beside it",
    (_name, stated) => {
      expect(
        readProtectedFirst({
          label: KID,
          protectedMap: bucket([[KID, stated]]),
          unprotected: bucket([[KID, OTHER]]),
        }),
      ).toBe(stated);
    },
  );

  test("answers the unprotected value where the protected bucket does not state the label", () => {
    expect(
      readProtectedFirst({
        label: KID,
        protectedMap: bucket(),
        unprotected: bucket([[KID, OTHER]]),
      }),
    ).toBe(OTHER);
  });

  test("answers the unprotected value where the protected slot holds no readable map", () => {
    expect(
      readProtectedFirst({
        label: KID,
        protectedMap: undefined,
        unprotected: bucket([[KID, OTHER]]),
      }),
    ).toBe(OTHER);
  });

  // RFC 9052 §1.5 — `cose-label.ts`.
  test("a protected text label does not state its integer namesake", () => {
    expect(
      readProtectedFirst({
        label: KID,
        protectedMap: bucket([[String(KID), Buffer.from("key-1", "utf8")]]),
        unprotected: bucket([[KID, OTHER]]),
      }),
    ).toBe(OTHER);
  });

  test("answers nothing where neither bucket states the label", () => {
    expect(
      readProtectedFirst({ label: KID, protectedMap: bucket(), unprotected: bucket() }),
    ).toBeUndefined();
  });

  test.each([
    ["nil", null],
    ["absent", undefined],
    ["an int", 42],
    ["a tstr", "not a bucket"],
    ["an array", [KID]],
  ])("answers nothing where the unprotected slot is %s", (_name, unprotected) => {
    expect(
      readProtectedFirst({ label: KID, protectedMap: bucket(), unprotected }),
    ).toBeUndefined();
  });
});
