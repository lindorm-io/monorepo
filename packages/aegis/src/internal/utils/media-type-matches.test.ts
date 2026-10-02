import { describe, expect, test } from "vitest";
import { BUILT_IN_PROFILES } from "../profiles/registry.js";
import { mediaTypeMatches } from "./media-type-matches.js";

/**
 * EVERY MEDIA TYPE A BUILT-IN PROFILE MANDATES, beside the same type spelled
 * without its `application/` prefix and lower-cased — the two spellings
 * RFC 7515 §4.1.9 obliges a recipient to treat as one, and for the access token
 * the pair RFC 9068 §4 names.
 *
 * ⚠ FROZEN LITERALS, never read off the descriptors: a table derived from the
 * registry would compare the registry to itself. The check below binds the frozen
 * set to the registry, so a new profile with a type nothing states fails there.
 */
const MANDATED: ReadonlyArray<[declared: string, short: string]> = [
  ["JWT", "jwt"],
  ["application/at+jwt", "at+jwt"],
  ["application/delegation+jwt", "delegation+jwt"],
  ["application/erasure+jwt", "erasure+jwt"],
  ["application/logout+jwt", "logout+jwt"],
  ["application/secevent+jwt", "secevent+jwt"],
  ["application/token-introspection+jwt", "token-introspection+jwt"],
];

/**
 * Every mandated type against every OTHER type's two spellings — the property that
 * makes the mandated set a set: no mandated media type names another. Derived from
 * {@link MANDATED}, so an eighth profile type is crossed with the rest as soon as
 * the check above admits it, rather than waiting for a row of its own.
 */
const DISTINCT: ReadonlyArray<[declared: string, other: string]> = MANDATED.flatMap(
  ([declared], index) =>
    MANDATED.flatMap((spellings, otherIndex) =>
      index === otherIndex
        ? []
        : spellings.map((other): [string, string] => [declared, other]),
    ),
);

/** Every US-ASCII code point — the alphabet RFC 2045 §5.1 writes a media type in. */
const ASCII: ReadonlyArray<string> = Array.from({ length: 128 }, (_, code) =>
  String.fromCodePoint(code),
);

describe("mediaTypeMatches", () => {
  describe("every media type a built-in profile mandates", () => {
    test("states one pair per mandated media type", () => {
      const mandated = BUILT_IN_PROFILES.flatMap((profile) =>
        profile.typ.presence === "required" ? [profile.typ.value] : [],
      );

      expect([...new Set(mandated)].sort()).toEqual(
        MANDATED.map(([declared]) => declared).sort(),
      );
    });

    test.each(MANDATED)("%s is named by %s", (declared, short) => {
      expect(mediaTypeMatches(short, declared)).toBe(true);
    });

    test.each(DISTINCT)("%s does not name %s", (declared, other) => {
      expect(mediaTypeMatches(declared, other)).toBe(false);
    });
  });

  describe("a value carrying no slash reads as application/ plus the value", () => {
    test("names the type it is shorthand for", () => {
      expect(mediaTypeMatches("example", "application/example")).toBe(true);
    });

    test("names it from the declared side too", () => {
      expect(mediaTypeMatches("application/example", "example")).toBe(true);
    });

    test("does not name a type of another tree", () => {
      expect(mediaTypeMatches("example", "text/example")).toBe(false);
    });

    test("does not name a type whose subtype merely ends the same way", () => {
      expect(mediaTypeMatches("jwt", "application/at+jwt")).toBe(false);
    });
  });

  describe("a type and subtype are case insensitive", () => {
    test("names the type when the subtype is shouted", () => {
      expect(mediaTypeMatches("application/AT+JWT", "application/at+jwt")).toBe(true);
    });

    test("names the type when the tree is shouted", () => {
      expect(mediaTypeMatches("APPLICATION/at+jwt", "application/at+jwt")).toBe(true);
    });

    test("names the bare conventional type spelled in lower case", () => {
      expect(mediaTypeMatches("jwt", "JWT")).toBe(true);
    });

    test("names it when the declared side is the shouted one", () => {
      expect(mediaTypeMatches("application/at+jwt", "APPLICATION/AT+JWT")).toBe(true);
    });
  });

  /**
   * RFC 2045 §5.1 builds a type and subtype from US-ASCII, so the case
   * insensitivity RFC 7515 §4.1.9 imports is ASCII case insensitivity. A full
   * Unicode fold reads U+212A KELVIN SIGN as an ASCII `k`, which would let a
   * `typ` that is no media type at all name the introspection profile's own —
   * accepted by the well-formedness gate (`assert-wire-typ.ts`) on its `+jwt`
   * ending, and then matched by the floor.
   */
  describe("only an ASCII letter folds", () => {
    test("a KELVIN SIGN names no type whose subtype spells k", () => {
      expect(
        mediaTypeMatches(
          "application/to\u212Aen-introspection+jwt",
          "application/token-introspection+jwt",
        ),
      ).toBe(false);
    });

    test("a CAPITAL SHARP S names no type whose subtype spells \u00DF", () => {
      expect(mediaTypeMatches("application/\u1E9E+jwt", "application/\u00DF+jwt")).toBe(
        false,
      );
    });

    test("names every US-ASCII spelling a full Unicode fold names", () => {
      const unnamed = ASCII.filter(
        (char) =>
          !mediaTypeMatches(
            `application/x${char}+jwt`,
            `application/x${char.toLowerCase()}+jwt`,
          ),
      );

      expect(unnamed).toEqual([]);
    });
  });

  describe("a parameter value is case sensitive", () => {
    test("names a parameterised type spelled identically", () => {
      expect(
        mediaTypeMatches(
          'application/example;part="1/2"',
          'application/example;part="1/2"',
        ),
      ).toBe(true);
    });

    test("folds the type and subtype of a parameterised type", () => {
      expect(
        mediaTypeMatches(
          'APPLICATION/EXAMPLE;part="1/2"',
          'application/example;part="1/2"',
        ),
      ).toBe(true);
    });

    test("does not name a parameterised type whose parameter value is cased differently", () => {
      expect(
        mediaTypeMatches('application/example;part="A"', 'application/example;part="a"'),
      ).toBe(false);
    });

    test("does not name the bare type a parameterised value builds on", () => {
      expect(
        mediaTypeMatches("application/at+jwt;charset=utf-8", "application/at+jwt"),
      ).toBe(false);
    });

    test("prepends nothing to a parameterised value whose parameter carries the slash", () => {
      expect(
        mediaTypeMatches('example;part="1/2"', 'application/example;part="1/2"'),
      ).toBe(false);
    });
  });

  describe("a value that is no media type at all", () => {
    test("an absent type names nothing", () => {
      expect(mediaTypeMatches(undefined, "application/at+jwt")).toBe(false);
    });

    // `""` normalises to the subtype-less `application/`, which RFC 2045 §5.1 makes
    // no media type; the pair reaches no door, since `assert-wire-typ.ts` refuses an
    // empty `typ`.
    test("an empty type names no media type with a subtype", () => {
      expect(mediaTypeMatches("", "application/at+jwt")).toBe(false);
    });

    // No door delivers one (`non-text-typ.test.ts`), so this pins the function
    // alone.
    test("a CoAP Content-Format integer names nothing", () => {
      expect(mediaTypeMatches(61 as never, "application/cwt")).toBe(false);
    });
  });
});
