import { describe, expect, test } from "vitest";
import { mergeCoseUnprotected } from "./merge-cose-unprotected.js";

describe("mergeCoseUnprotected", () => {
  test("writes kid (4) as a utf8 byte string", () => {
    const map = mergeCoseUnprotected({
      kid: "key_test",
      entries: new Map(),
      proprietary: false,
    });

    expect([...map.keys()]).toEqual([4]);
    expect((map.get(4) as Buffer).toString("utf8")).toBe("key_test");
  });

  test("writes the IV (5) when the structure has one", () => {
    const map = mergeCoseUnprotected({
      kid: "key_test",
      iv: Buffer.from("iv-bytes", "utf8"),
      entries: new Map(),
      proprietary: false,
    });

    expect((map.get(5) as Buffer).toString("utf8")).toBe("iv-bytes");
  });

  test("the signed kits have NO IV, so their bucket carries kid alone", () => {
    expect([
      ...mergeCoseUnprotected({
        kid: "key_test",
        entries: new Map(),
        proprietary: false,
      }).keys(),
    ]).toEqual([4]);
  });

  test("the caller's entries are merged in", () => {
    const map = mergeCoseUnprotected({
      kid: "key_test",
      iv: Buffer.from("iv", "utf8"),
      entries: new Map<number | string, unknown>([[9, "counter-signature"]]),
      proprietary: false,
    });

    expect(map.size).toBe(3);
    expect(map.get(9)).toBe("counter-signature");
  });

  // The twin of the protected bucket's mode test, and it states the same fact:
  // the interop mode reaches here so ONE resolver spells every parameter, not
  // because `kid` (4) or `iv` (5) can move — both are REGISTERED labels, and
  // only a PRIVATE-USE one (< -65536) degrades to its string spelling. The day a
  // derived parameter is given a private-use label, this fails instead of the
  // token silently carrying an integer no foreign reader can interpret.
  test("the interop mode changes nothing here — kid and iv are REGISTERED", () => {
    const keys = (proprietary: boolean): Array<number | string> => [
      ...mergeCoseUnprotected({
        kid: "key_test",
        iv: Buffer.from("iv", "utf8"),
        entries: new Map(),
        proprietary,
      }).keys(),
    ];

    expect(keys(false)).toEqual([5, 4]);
    expect(keys(true)).toEqual([5, 4]);
  });
});
