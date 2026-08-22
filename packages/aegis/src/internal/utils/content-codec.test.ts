import { describe, expect, test } from "vitest";
import { decodeCbor, encodeCbor } from "../cose/cbor.js";
import { reconstructContent, serialiseContent } from "./content-codec.js";

describe("content-codec", () => {
  describe("serialiseContent", () => {
    test("infers application/json for a Dict and serialises to JSON bytes", () => {
      const { bytes, contentType } = serialiseContent({ a: 1, b: "two" });

      expect(contentType).toBe("application/json");
      expect(bytes).toEqual(Buffer.from(JSON.stringify({ a: 1, b: "two" }), "utf8"));
    });

    test("infers application/json for an array, number, and boolean", () => {
      expect(serialiseContent(["x", "y"]).contentType).toBe("application/json");
      expect(serialiseContent(42).contentType).toBe("application/json");
      expect(serialiseContent(true).contentType).toBe("application/json");
    });

    // ⭐ ONE ENCODING FOR OPAQUE CONTENT, ON EVERY DOOR — the property that
    // replaced the per-kit `structured: "cbor" | "json"` parameter. There was
    // never a caller that passed `"cbor"`: the CBOR write arm existed for a CWE
    // claims plaintext, and that plaintext went away when encrypt/decrypt became
    // a pure confidentiality pair. A CWT's CLAIMS still reach the wire as CBOR —
    // through `internal/cose/cwt-message.ts` and its RFC 8392 integer labels,
    // which is a different road that never touches this codec.
    test("the COSE doors serialise a Dict to the SAME JSON bytes the JOSE doors do", () => {
      const json = Buffer.from(JSON.stringify({ a: 1, b: "two" }), "utf8");

      expect(serialiseContent({ a: 1, b: "two" }).bytes).toEqual(json);
      // …and they are NOT the CBOR encoding of the same value, which is what the
      // deleted family produced.
      expect(serialiseContent({ a: 1, b: "two" }).bytes).not.toEqual(
        encodeCbor({ a: 1, b: "two" }),
      );
    });

    test("infers text/plain for a string and serialises to utf8 bytes", () => {
      const { bytes, contentType } = serialiseContent("hello");

      expect(contentType).toBe("text/plain");
      expect(bytes).toEqual(Buffer.from("hello", "utf8"));
    });

    test("infers application/octet-stream for a Buffer and passes it through", () => {
      const input = Buffer.from([1, 2, 3, 4]);
      const { bytes, contentType } = serialiseContent(input);

      expect(contentType).toBe("application/octet-stream");
      expect(bytes).toBe(input);
    });

    test("a caller-supplied cty WINS as the wire label (bytes still by JS type)", () => {
      // A nested JWT: a compact JWS string labelled `JWT`. Bytes are the utf8 of the
      // string; the label is the caller's, not the inferred text/plain.
      const { bytes, contentType } = serialiseContent("aaa.bbb.ccc", "JWT");

      expect(contentType).toBe("JWT");
      expect(bytes).toEqual(Buffer.from("aaa.bbb.ccc", "utf8"));
    });

    test("throws an urn-typed AegisError for an unsupported value", () => {
      expect(() => serialiseContent(undefined as never)).toThrow("Invalid content type");
    });
  });

  describe("reconstructContent", () => {
    test("application/json → the deep-equal native object", () => {
      const original = { a: 1, nested: { b: [2, 3], c: "four" } };
      const bytes = serialiseContent(original).bytes;

      expect(reconstructContent(bytes, "application/json")).toEqual(original);
    });

    // ⚠ A READ-ONLY case, and the bytes are therefore produced by `encodeCbor`
    // rather than by the codec: aegis never WRITES `application/cbor`, so the only
    // producer of such a payload is a FOREIGN token declaring the media type
    // RFC 8949 §9.3 registers. Without the case it falls through to the `buffer`
    // fallback and a caller gets bytes where the producer stated an object.
    test("a FOREIGN application/cbor payload → the deep-equal native object", () => {
      const original = { a: 1, nested: { b: [2, 3], c: "four" } };
      const bytes = encodeCbor(original);

      expect(decodeCbor(bytes, { preferMap: false })).toEqual(original);
      expect(reconstructContent(bytes, "application/cbor")).toEqual(original);
    });

    test("text/plain → the native string", () => {
      const bytes = serialiseContent("hej").bytes;

      expect(reconstructContent(bytes, "text/plain")).toBe("hej");
    });

    test("application/octet-stream → the raw Buffer", () => {
      const input = Buffer.from([9, 8, 7]);
      const bytes = serialiseContent(input).bytes;

      expect(reconstructContent(bytes, "application/octet-stream")).toEqual(input);
    });

    test("a JOSE token cty → the native token STRING", () => {
      const jwt = "aaa.bbb.ccc";
      const bytes = serialiseContent(jwt, "JWT").bytes;

      expect(reconstructContent(bytes, "JWT")).toBe(jwt);
      expect(reconstructContent(bytes, "application/jwt")).toBe(jwt);
      expect(reconstructContent(bytes, "application/at+jwt")).toBe(jwt);
    });

    /**
     * `application/jose` is what an outer declares over a nested JWS or JWE.
     * RFC 7515 §9.2.1.
     *
     * ⚠ BOTH spellings must resolve, and the bare one is the RFC's own preference
     * (RFC 7515 §4.1.10): reading only the full form sends a conformant producer's
     * token to the `buffer` fallback, where a nested token is not a token.
     */
    test("both spellings of application/jose → the native token STRING", () => {
      const jws = "aaa.bbb.ccc";
      const bytes = serialiseContent(jws, "application/jose").bytes;

      expect(reconstructContent(bytes, "application/jose")).toBe(jws);
      expect(reconstructContent(bytes, "jose")).toBe(jws);
      // Case-insensitive per RFC 2045, which `bareMediaType` lower-cases for.
      expect(reconstructContent(bytes, "JOSE")).toBe(jws);
      expect(reconstructContent(bytes, "application/jose; charset=utf-8")).toBe(jws);
    });

    test("a COSE token cty → the native token BUFFER", () => {
      const cwt = Buffer.from([0xd2, 0x84, 0x40]);
      const bytes = serialiseContent(cwt, "application/cwt").bytes;

      expect(reconstructContent(bytes, "application/cwt")).toEqual(cwt);
      expect(reconstructContent(bytes, "application/foo+cwt")).toEqual(cwt);
      expect(reconstructContent(bytes, "application/foo+cwm")).toEqual(cwt);
    });

    test("an absent cty → the raw Buffer fallback", () => {
      const bytes = Buffer.from("opaque");

      expect(reconstructContent(bytes, undefined)).toEqual(bytes);
    });

    test("an unknown cty → the raw Buffer fallback (never guess a parse)", () => {
      const bytes = Buffer.from("opaque");

      expect(reconstructContent(bytes, "application/x-unknown")).toEqual(bytes);
    });

    test("tolerates RFC 2045 media-type parameters on the cty", () => {
      const jsonBytes = serialiseContent({ ok: true }).bytes;
      expect(reconstructContent(jsonBytes, "application/json; charset=utf-8")).toEqual({
        ok: true,
      });

      const cborBytes = encodeCbor({ ok: true });
      expect(reconstructContent(cborBytes, "application/cbor; charset=utf-8")).toEqual({
        ok: true,
      });

      const textBytes = serialiseContent("charged").bytes;
      expect(reconstructContent(textBytes, "text/plain; charset=utf-8")).toBe("charged");
    });
  });
});
