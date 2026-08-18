import { describe, expect, test } from "vitest";
import { protoMemberViolations } from "./proto-member-violations.js";

/**
 * ⚠ EVERY HOSTILE INPUT HERE IS BUILT WITH `JSON.parse` OR A COMPUTED KEY, NEVER
 * WITH AN OBJECT LITERAL. `{ "__proto__": … }` in source is a PROTOTYPE SETTER at
 * parse time and creates no own key at all, so a literal would hand this scan a
 * clean object and every row would pass without checking anything.
 *
 * ⚠ THE BEHAVIOURAL PINS LIVE ELSEWHERE — `classes/events-claim-wire.test.ts`,
 * `classes/act-claim-wire.test.ts` and `classes/sub-id-claim-wire.test.ts` drive
 * the real `aegis.parse` door with forged tokens. This file pins the SCAN's own
 * contract: which containers it descends, how it names a position, and that it
 * terminates.
 */

const parse = (json: string): unknown => JSON.parse(json);

describe("protoMemberViolations", () => {
  test("a clean value of any shape yields nothing", () => {
    expect(
      protoMemberViolations(parse('{"a":{"b":[1,"x",{"c":true}]}}'), "claim"),
    ).toEqual([]);
    expect(protoMemberViolations("a string", "claim")).toEqual([]);
    expect(protoMemberViolations(42, "claim")).toEqual([]);
    expect(protoMemberViolations(null, "claim")).toEqual([]);
    expect(protoMemberViolations(undefined, "claim")).toEqual([]);
    expect(protoMemberViolations(new Date(0), "claim")).toEqual([]);
  });

  test("a `__proto__` at the root names the claim as its container", () => {
    expect(protoMemberViolations(parse('{"__proto__":{"pwn":1}}'), "events")).toEqual([
      {
        key: "events.__proto__",
        message:
          'Member "__proto__" is not a member name any structure may use, in "events"',
      },
    ]);
  });

  test("a `__proto__` at depth is located by the path of the container carrying it", () => {
    expect(
      protoMemberViolations(
        parse('{"urn:e":{"payload":{"__proto__":{"pwn":1}}}}'),
        "events",
      ),
    ).toEqual([
      {
        key: "events.urn:e.payload.__proto__",
        message:
          'Member "__proto__" is not a member name any structure may use, in "events.urn:e.payload"',
      },
    ]);
  });

  test("an array element is located by its index", () => {
    expect(
      protoMemberViolations(
        parse('{"identifiers":[{"format":"email"},{"__proto__":{"pwn":1}}]}'),
        "subjectId",
      ),
    ).toEqual([
      {
        key: "subjectId.identifiers[1].__proto__",
        message:
          'Member "__proto__" is not a member name any structure may use, in "subjectId.identifiers[1]"',
      },
    ]);
  });

  test("a `Map` is descended, because a COSE label may be a text string", () => {
    // RFC 9052 §1.5 defines a COSE map key as `label = int / tstr`, so a text
    // `__proto__` is a legal label — and `cbor2` decodes it to an OWN key rather
    // than to a prototype swap, which is exactly what makes it reachable here.
    const map = new Map<string | number, unknown>([
      [2, "declared"],
      ["__proto__", { pwn: 1 }],
    ]);

    expect(protoMemberViolations(new Map([["act", map]]), "act")).toEqual([
      {
        key: "act.act.__proto__",
        message:
          'Member "__proto__" is not a member name any structure may use, in "act.act"',
      },
    ]);
  });

  test("an INTEGER label cannot be mistaken for the member name", () => {
    // The comparison is against the string, never a coercion of the key, so no
    // integer label can collide with it — and the walk still descends through one.
    const map = new Map<number, unknown>([[7, parse('{"__proto__":{"pwn":1}}')]]);

    expect(protoMemberViolations(map, "act")).toEqual([
      {
        key: "act.7.__proto__",
        message:
          'Member "__proto__" is not a member name any structure may use, in "act.7"',
      },
    ]);
  });

  test("every occurrence is reported, not the first", () => {
    // The claim boundary reports everything wrong with one claim at once; a scan
    // that stopped at the first would make a caller fix a hostile token one member
    // at a time.
    const value = parse(
      '{"a":{"__proto__":{"pwn":1}},"b":[{"__proto__":{"pwn":2}}],"c":{"__proto__":{"pwn":3}}}',
    );

    expect(protoMemberViolations(value, "claim").map((entry) => entry.key)).toEqual([
      "claim.a.__proto__",
      "claim.b[0].__proto__",
      "claim.c.__proto__",
    ]);
  });

  test("a self-referential value terminates instead of hanging", () => {
    // `Aegis.toWire` takes a caller's own object graph, which before this scan
    // reached the wire with no recursive walk at all — so an unguarded scan would
    // turn a passthrough into a hang rather than merely being untidy.
    const cyclic: Record<string, unknown> = { name: "loop" };
    cyclic.self = cyclic;

    const cyclicArray: Array<unknown> = ["head"];
    cyclicArray.push(cyclicArray);

    expect(protoMemberViolations(cyclic, "claim")).toEqual([]);
    expect(protoMemberViolations(cyclicArray, "claim")).toEqual([]);
  });

  test("a container reached twice by two paths is reported under BOTH", () => {
    // The cycle guard tracks the IN-PROGRESS ancestors, not every container ever
    // seen. A memo would report a shared hostile sub-object under whichever path
    // happened to be walked first and stay silent about the other.
    const shared = parse('{"__proto__":{"pwn":1}}');

    expect(
      protoMemberViolations({ first: shared, second: shared }, "claim").map(
        (entry) => entry.key,
      ),
    ).toEqual(["claim.first.__proto__", "claim.second.__proto__"]);
  });
});
