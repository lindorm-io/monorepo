import { TOKEN_TYPE_TO_SHORT_NAME } from "../../constants/token-type.js";
import {
  computeTypHeader,
  decodeTokenTypeFromTyp,
  extractTypPrefix,
  getBaseFormat,
} from "./compute-typ-header.js";
import { describe, expect, test } from "vitest";

describe("computeTypHeader", () => {
  describe("known token types", () => {
    test("maps access_token to application/at+jwt for jwt format", () => {
      expect(computeTypHeader("access_token", "jwt")).toBe("application/at+jwt");
    });

    test("maps refresh_token to application/rt+jws for jws format", () => {
      expect(computeTypHeader("refresh_token", "jws")).toBe("application/rt+jws");
    });

    /**
     * ⭐ A TOKEN TYPE WITH NO STRUCTURED FORM FLOORS TO THE BARE FORM OF THE
     * FORMAT ASKED FOR — not to the JOSE one.
     *
     * `id_token` maps to the short name `JWT` (OIDC Core §2 — an ID Token is a
     * plain JWT and no `id+jwt` media type is registered), so there is no
     * `application/<prefix>+<fmt>` to build. What is left is the format's own
     * conventional value, and the seven differ: RFC 7515 §4.1.9 abbreviates the
     * JOSE ones, RFC 8392 §9.2 / RFC 9052 §3.1 keep `application/` on the COSE
     * ones.
     *
     * ⚠ EVERY FORMAT IS EXERCISED, not just `jwt`. Answering `"JWT"` for a COSE
     * format is not a cosmetic mis-stamp: `extractTypPrefix` THROWS on it,
     * because `"JWT"` is neither `application/cwt` nor a `+cwt` media type.
     */
    test.each([
      ["jwt", "JWT"],
      ["jws", "JWS"],
      ["jwe", "JWE"],
      ["cwt", "application/cwt"],
      ["cwm", "application/cwt"],
      ["cws", "application/cws"],
      ["cwe", "application/cwe"],
    ] as const)("maps id_token to the bare %s form", (kitFormat, expected) => {
      expect(computeTypHeader("id_token", kitFormat)).toBe(expected);
    });

    // And the value it floors to is one `extractTypPrefix` can read back, on
    // every format — the round trip is what the throw broke.
    test.each(["jwt", "jws", "jwe", "cwt", "cwm", "cws", "cwe"] as const)(
      "the bare %s form reduces back to no prefix",
      (kitFormat) => {
        expect(
          extractTypPrefix(computeTypHeader("id_token", kitFormat), kitFormat),
        ).toBeUndefined();
      },
    );

    test("maps security_event to application/secevent+jwt", () => {
      expect(computeTypHeader("security_event", "jwt")).toBe("application/secevent+jwt");
    });

    test("maps dpop to application/dpop+jwt", () => {
      expect(computeTypHeader("dpop", "jwt")).toBe("application/dpop+jwt");
    });

    test("maps logout_token to application/logout+jwt", () => {
      expect(computeTypHeader("logout_token", "jwt")).toBe("application/logout+jwt");
    });

    test("maps erasure_token to application/erasure+jwt", () => {
      expect(computeTypHeader("erasure_token", "jwt")).toBe("application/erasure+jwt");
    });
  });

  describe("custom token types", () => {
    test("passes unknown token types through with prefix and suffix", () => {
      expect(computeTypHeader("my_custom_thing", "jwt")).toBe(
        "application/my_custom_thing+jwt",
      );
    });
  });

  describe("undefined tokenType", () => {
    test("returns format fallback for jwt", () => {
      expect(computeTypHeader(undefined, "jwt")).toBe("JWT");
    });

    test("returns format fallback for jws", () => {
      expect(computeTypHeader(undefined, "jws")).toBe("JWS");
    });

    test("returns format fallback for jwe", () => {
      expect(computeTypHeader(undefined, "jwe")).toBe("JWE");
    });
  });

  describe("input validation", () => {
    test("rejects empty string", () => {
      expect(() => computeTypHeader("", "jwt")).toThrow(
        "tokenType cannot be an empty string",
      );
    });

    test("rejects tokenType containing a '+' character (double-suffix guard)", () => {
      expect(() => computeTypHeader("at+jwt", "jwt")).toThrow(
        /tokenType cannot contain '\+'/,
      );
    });

    test("rejects tokenType containing whitespace", () => {
      expect(() => computeTypHeader("my thing", "jwt")).toThrow(
        "tokenType cannot contain whitespace",
      );
    });

    test("rejects leading/trailing whitespace", () => {
      expect(() => computeTypHeader(" access_token", "jwt")).toThrow(
        "tokenType cannot contain whitespace",
      );
      expect(() => computeTypHeader("access_token ", "jwt")).toThrow(
        "tokenType cannot contain whitespace",
      );
    });
  });
});

describe("decodeTokenTypeFromTyp", () => {
  test("reverses known short names back to canonical token types (bare, lenient)", () => {
    expect(decodeTokenTypeFromTyp("at+jwt", "jwt")).toBe("access_token");
    expect(decodeTokenTypeFromTyp("rt+jws", "jws")).toBe("refresh_token");
    expect(decodeTokenTypeFromTyp("secevent+jwt", "jwt")).toBe("security_event");
    expect(decodeTokenTypeFromTyp("dpop+jwt", "jwt")).toBe("dpop");
    expect(decodeTokenTypeFromTyp("erasure+jwt", "jwt")).toBe("erasure_token");
  });

  test("strips the application/ prefix and reverses to canonical token types", () => {
    expect(decodeTokenTypeFromTyp("application/at+jwt", "jwt")).toBe("access_token");
    expect(decodeTokenTypeFromTyp("application/rt+jws", "jws")).toBe("refresh_token");
    expect(decodeTokenTypeFromTyp("application/secevent+jwt", "jwt")).toBe(
      "security_event",
    );
    expect(decodeTokenTypeFromTyp("application/dpop+jwt", "jwt")).toBe("dpop");
    expect(decodeTokenTypeFromTyp("application/erasure+jwt", "jwt")).toBe(
      "erasure_token",
    );
  });

  /**
   * ⭐ THE SUBTYPE CARRIES NO CASE (RFC 7515 §4.1.9), so the type a header
   * REPORTS is the one the verify floor matched it against — the floor compares
   * `typ` as a media type (`media-type-matches.ts`), and a reverse lookup that
   * compared the spelling would report the wire's letters for a token it had
   * just accepted as an access token.
   *
   * The `application/` prefix folds with it: it is the media type's TYPE half,
   * equally case insensitive. So does the structured suffix, and that is why the
   * lookup tests for it on the NORMALISED value: `typ.endsWith(suffix)` on the raw
   * one reports NO token type for a spelling `media-type-matches.ts` reads as the
   * very media type the floor matched.
   */
  test.each([
    ["application/AT+jwt", "jwt", "access_token"],
    ["AT+jwt", "jwt", "access_token"],
    ["APPLICATION/at+jwt", "jwt", "access_token"],
    ["application/At+jwt", "jwt", "access_token"],
    ["application/RT+jws", "jws", "refresh_token"],
    ["application/SecEvent+jwt", "jwt", "security_event"],
    ["application/LOGOUT+jwt", "jwt", "logout_token"],
    ["application/DPoP+jwt", "jwt", "dpop"],
    ["application/Erasure+jwt", "jwt", "erasure_token"],
    ["application/AT+JWT", "jwt", "access_token"],
    ["logout+JWT", "jwt", "logout_token"],
    ["application/RT+JWS", "jws", "refresh_token"],
  ] as const)(
    "reads the type %s on a %s as the token type %s",
    (typ, kitFormat, expected) => {
      expect(decodeTokenTypeFromTyp(typ, kitFormat)).toBe(expected);
    },
  );

  // Every mandated short name, so a type added to the table cannot be matched on
  // one spelling and missed on another. `id_token` is excluded because its own
  // typ is the bare conventional form, covered below in its own right.
  test.each(
    Object.entries(TOKEN_TYPE_TO_SHORT_NAME).filter(([, short]) => short !== "JWT"),
  )("reads the upper-case typ of %s as itself", (tokenType, shortName) => {
    expect(
      decodeTokenTypeFromTyp(`application/${shortName.toUpperCase()}+jwt`, "jwt"),
    ).toBe(tokenType);
  });

  // The reverse lookup is a lookup only while the folded short names stay
  // distinct: two token types sharing one would make the answer the table's
  // order.
  test("gives no two token types the same short name once case is folded", () => {
    const folded = Object.values(TOKEN_TYPE_TO_SHORT_NAME).map((short) =>
      short.toLowerCase(),
    );

    expect(new Set(folded).size).toBe(folded.length);
  });

  test("returns the short name for unknown types", () => {
    expect(decodeTokenTypeFromTyp("my_custom_thing+jwt", "jwt")).toBe("my_custom_thing");
    expect(decodeTokenTypeFromTyp("application/access+jwt", "jwt")).toBe("access");
  });

  // An unrecognised short name is reported in the ONE spelling the media type
  // has, as a known one is. The letters the token wrote stay readable on
  // `headerType` — pinned: __features__/Aegis.profile-floor.feature.
  test("folds the short name of an unknown type", () => {
    expect(decodeTokenTypeFromTyp("My_Custom_Thing+jwt", "jwt")).toBe("my_custom_thing");
    expect(decodeTokenTypeFromTyp("application/ACCESS+jwt", "jwt")).toBe("access");
  });

  test("returns undefined for format fallback (bare JWT treated as ambiguous)", () => {
    expect(decodeTokenTypeFromTyp("JWT", "jwt")).toBeUndefined();
    expect(decodeTokenTypeFromTyp("JWS", "jws")).toBeUndefined();
  });

  // The bare form is a media type too, so its own case says nothing either —
  // every format's, because each floors to a spelling of its own.
  test.each(["jwt", "jws", "jwe", "cwt", "cwm", "cws", "cwe"] as const)(
    "reads the bare %s form as no token type in any case",
    (kitFormat) => {
      const bare = computeTypHeader(undefined, kitFormat);

      expect(decodeTokenTypeFromTyp(bare, kitFormat)).toBeUndefined();
      expect(decodeTokenTypeFromTyp(bare.toLowerCase(), kitFormat)).toBeUndefined();
      expect(decodeTokenTypeFromTyp(bare.toUpperCase(), kitFormat)).toBeUndefined();
    },
  );

  /**
   * `id_token`'s short name IS the bare conventional form (no `id+jwt` media
   * type is registered), so a typ naming it as a SUBTYPE is the one lookup the
   * table's own casing decides — and it decides the same way in either spelling.
   */
  test.each(["application/JWT+jwt", "application/jwt+jwt"])(
    "reads the type %s as the token type id_token",
    (typ) => {
      expect(decodeTokenTypeFromTyp(typ, "jwt")).toBe("id_token");
    },
  );

  test("returns undefined when typ is absent", () => {
    expect(decodeTokenTypeFromTyp(undefined, "jwt")).toBeUndefined();
  });

  test("returns undefined when typ doesn't match the kit format suffix", () => {
    expect(decodeTokenTypeFromTyp("at+jwt", "jws")).toBeUndefined();
    expect(decodeTokenTypeFromTyp("rt+jws", "jwt")).toBeUndefined();
  });
});

describe("getBaseFormat", () => {
  describe("bare conventional forms", () => {
    test("recognizes JWT", () => {
      expect(getBaseFormat("JWT")).toBe("JWT");
    });

    test("recognizes JWS", () => {
      expect(getBaseFormat("JWS")).toBe("JWS");
    });

    test("recognizes JOSE as JWS (legacy)", () => {
      expect(getBaseFormat("JOSE")).toBe("JWS");
    });

    test("recognizes JWE", () => {
      expect(getBaseFormat("JWE")).toBe("JWE");
    });
  });

  describe("suffix forms", () => {
    test("recognizes +jwt suffix", () => {
      expect(getBaseFormat("at+jwt")).toBe("JWT");
      expect(getBaseFormat("dpop+jwt")).toBe("JWT");
      expect(getBaseFormat("my_custom+jwt")).toBe("JWT");
    });

    test("recognizes the application/ prefixed +jwt suffix", () => {
      expect(getBaseFormat("application/at+jwt")).toBe("JWT");
      expect(getBaseFormat("application/secevent+jwt")).toBe("JWT");
    });

    test("recognizes +jws suffix", () => {
      expect(getBaseFormat("rt+jws")).toBe("JWS");
    });

    test("recognizes +jwe suffix", () => {
      expect(getBaseFormat("logout+jwe")).toBe("JWE");
    });
  });

  describe("unknown and undefined", () => {
    test("returns undefined when typ is undefined", () => {
      expect(getBaseFormat(undefined)).toBeUndefined();
    });

    test("returns undefined for unrecognized typ", () => {
      expect(getBaseFormat("something-weird")).toBeUndefined();
    });

    test("returns undefined for empty string", () => {
      expect(getBaseFormat("")).toBeUndefined();
    });
  });
});
