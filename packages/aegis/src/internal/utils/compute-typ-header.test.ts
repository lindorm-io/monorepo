import {
  computeTypHeader,
  decodeTokenTypeFromTyp,
  getBaseFormat,
} from "./compute-typ-header.js";
import { describe, expect, test } from "vitest";

describe("computeTypHeader", () => {
  describe("known token types", () => {
    test("maps access_token to at+jwt for jwt format", () => {
      expect(computeTypHeader("access_token", "jwt")).toBe("at+jwt");
    });

    test("maps refresh_token to rt+jws for jws format", () => {
      expect(computeTypHeader("refresh_token", "jws")).toBe("rt+jws");
    });

    test("maps id_token to bare JWT regardless of format", () => {
      expect(computeTypHeader("id_token", "jwt")).toBe("JWT");
    });

    test("maps security_event to secevent+jwt", () => {
      expect(computeTypHeader("security_event", "jwt")).toBe("secevent+jwt");
    });

    test("maps dpop to dpop+jwt", () => {
      expect(computeTypHeader("dpop", "jwt")).toBe("dpop+jwt");
    });

    test("maps logout_token to logout+jwt", () => {
      expect(computeTypHeader("logout_token", "jwt")).toBe("logout+jwt");
    });
  });

  describe("custom token types", () => {
    test("passes unknown token types through with suffix", () => {
      expect(computeTypHeader("my_custom_thing", "jwt")).toBe("my_custom_thing+jwt");
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
  test("reverses known short names back to canonical token types", () => {
    expect(decodeTokenTypeFromTyp("at+jwt", "jwt")).toBe("access_token");
    expect(decodeTokenTypeFromTyp("rt+jws", "jws")).toBe("refresh_token");
    expect(decodeTokenTypeFromTyp("secevent+jwt", "jwt")).toBe("security_event");
    expect(decodeTokenTypeFromTyp("dpop+jwt", "jwt")).toBe("dpop");
  });

  test("returns the raw short name for unknown types", () => {
    expect(decodeTokenTypeFromTyp("my_custom_thing+jwt", "jwt")).toBe("my_custom_thing");
  });

  test("returns undefined for format fallback (bare JWT treated as ambiguous)", () => {
    expect(decodeTokenTypeFromTyp("JWT", "jwt")).toBeUndefined();
    expect(decodeTokenTypeFromTyp("JWS", "jws")).toBeUndefined();
  });

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
