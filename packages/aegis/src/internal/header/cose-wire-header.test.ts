import { describe, expect, test } from "vitest";
import { CoseError } from "../../errors/index.js";
import { Tag } from "../cose/cbor.js";
import type { CoseLabel } from "../cose/cose-label.js";
import { type CoseAlgKind, coseWireHeader } from "./cose-wire-header.js";
import { coseByJose } from "./header-registry.js";

const TYP = coseByJose("typ");
const CTY = coseByJose("cty");

/**
 * Every CBOR shape a producer can write under label 16 other than a text string,
 * one per major type plus the simple values and the integer edges.
 */
const NOT_TEXT: ReadonlyArray<[shape: string, value: unknown]> = [
  ["the uint 0", 0],
  ["a CoAP Content-Format uint", 61],
  ["a uint beyond the safe integers", 18446744073709551615n],
  ["a negative integer", -1],
  ["a float", 1.5],
  ["false", false],
  ["true", true],
  ["null", null],
  ["undefined", undefined],
  ["a byte string", Buffer.from("application/at+cwt", "utf8")],
  ["an array", ["application/at+cwt"]],
  ["a map", new Map<CoseLabel, unknown>([[1, "application/at+cwt"]])],
  ["a tagged text string", new Tag(32, "application/at+cwt")],
];

const refusalOf = (read: () => unknown): unknown => {
  try {
    read();
  } catch (error) {
    return error;
  }

  return undefined;
};

describe.each<[CoseAlgKind]>([["sig"], ["enc"]])(
  "coseWireHeader — the typ parameter (label 16) on a %s bucket",
  (algKind) => {
    test.each(NOT_TEXT)("refuses a typ that is %s", (_shape, typ) => {
      const thrown = refusalOf(() =>
        coseWireHeader(new Map<CoseLabel, unknown>([[TYP, typ]]), algKind),
      );

      expect(thrown).toBeInstanceOf(CoseError);
      expect(thrown).toMatchObject({
        code: "cose_header_typ_invalid",
        message: "Invalid token header: typ must be a text string",
        title: "COSE Header Typ Invalid",
        details:
          "The decoded COSE header typ is present but is not a text string, so aegis cannot read it.",
      });
      expect((thrown as CoseError).data).toStrictEqual({});
    });

    test.each([["application/at+cwt"], ["application/cws"]])(
      "passes the text typ %j through unchanged",
      (typ) => {
        expect(
          coseWireHeader(new Map<CoseLabel, unknown>([[TYP, typ]]), algKind).header.typ,
        ).toBe(typ);
      },
    );

    test("reports an empty typ as written, leaving its refusal to the per-family typ gate", () => {
      expect(
        coseWireHeader(new Map<CoseLabel, unknown>([[TYP, ""]]), algKind).header.typ,
      ).toBe("");
    });
  },
);

/**
 * IANA "CoAP Content-Formats" rows, each beside its `Content Type` cell as the
 * registry writes it — parameters included.
 */
const REGISTERED: ReadonlyArray<[id: number, mediaType: string]> = [
  [0, "text/plain; charset=utf-8"],
  [16, 'application/cose; cose-type="cose-encrypt0"'],
  [50, "application/json"],
  [60, "application/cbor"],
  [61, "application/cwt"],
  [30000, "image/svg+xml"],
];

/** Every shape under label 3 the read refuses: integers outside the table, then every other CBOR type. */
const NOT_A_CONTENT_TYPE: ReadonlyArray<[shape: string, value: unknown]> = [
  ["the deflate-coded ID 11050", 11050],
  ["the deflate-coded ID 11060", 11060],
  ["the zstd-coded ID 12000", 12000],
  ["the zstd-coded ID 12041", 12041],
  ["the zstd-coded ID 12050", 12050],
  ["an ID the registry lists as Unassigned on its own row", 20],
  ["an ID inside an Unassigned range", 1],
  ["an ID reserved for experimental use", 65000],
  ["a uint beyond the safe integers", 18446744073709551615n],
  ["a negative integer", -1],
  ["a float", 1.5],
  ["false", false],
  ["true", true],
  ["null", null],
  ["undefined", undefined],
  ["a byte string", Buffer.from("application/cwt", "utf8")],
  ["an array", ["application/cwt"]],
  ["a map", new Map<CoseLabel, unknown>([[1, "application/cwt"]])],
  ["a tagged text string", new Tag(32, "application/cwt")],
];

describe.each<[CoseAlgKind]>([["sig"], ["enc"]])(
  "coseWireHeader — the cty parameter (label 3) on a %s bucket",
  (algKind) => {
    test.each(REGISTERED)(
      "reads the CoAP Content-Format %j as the registry's %j",
      (id, mediaType) => {
        expect(
          coseWireHeader(new Map<CoseLabel, unknown>([[CTY, id]]), algKind).header.cty,
        ).toBe(mediaType);
      },
    );

    test.each(NOT_A_CONTENT_TYPE)("refuses a cty that is %s", (_shape, cty) => {
      const thrown = refusalOf(() =>
        coseWireHeader(new Map<CoseLabel, unknown>([[CTY, cty]]), algKind),
      );

      expect(thrown).toBeInstanceOf(CoseError);
      expect(thrown).toMatchObject({
        code: "cose_header_cty_invalid",
        title: "COSE Header Cty Invalid",
      });
      expect((thrown as CoseError).data).toStrictEqual({});
    });

    test.each([["application/cwt"], ["text/plain; charset=utf-8"], ["1"]])(
      "passes the text cty %j through unchanged",
      (cty) => {
        expect(
          coseWireHeader(new Map<CoseLabel, unknown>([[CTY, cty]]), algKind).header.cty,
        ).toBe(cty);
      },
    );

    test("reports an empty cty as written", () => {
      expect(
        coseWireHeader(new Map<CoseLabel, unknown>([[CTY, ""]]), algKind).header.cty,
      ).toBe("");
    });
  },
);

const IV = coseByJose("iv");

/** Every CBOR shape a producer can write under label 5 other than a byte string. */
const NOT_BYTES: ReadonlyArray<[shape: string, value: unknown]> = [
  ["the uint 0", 0],
  ["a negative integer", -1],
  ["a uint beyond the safe integers", 18446744073709551615n],
  ["a float", 1.5],
  ["false", false],
  ["true", true],
  ["null", null],
  ["undefined", undefined],
  ["a text string", "AAAAAAAAAAAAAAAA"],
  ["an empty text string", ""],
  ["an array", [Buffer.alloc(12)]],
  ["a map", new Map<CoseLabel, unknown>([[1, Buffer.alloc(12)]])],
  ["a tagged byte string", new Tag(64, Buffer.alloc(12))],
];

describe.each<[CoseAlgKind]>([["sig"], ["enc"]])(
  "coseWireHeader — the IV parameter (label 5) on a %s bucket",
  (algKind) => {
    test.each(NOT_BYTES)("refuses an IV that is %s", (_shape, iv) => {
      const thrown = refusalOf(() =>
        coseWireHeader(new Map<CoseLabel, unknown>([[IV, iv]]), algKind),
      );

      expect(thrown).toBeInstanceOf(CoseError);

      const { name, code, title, details, data, debug, message } = thrown as CoseError;

      expect({ name, code, title, details, data, debug, message }).toMatchSnapshot();
    });

    test.each([
      ["a twelve-octet nonce", Buffer.alloc(12, 0xfb)],
      ["an empty byte string", Buffer.alloc(0)],
      ["a Uint8Array", new Uint8Array([0xfb, 0xff])],
    ])("reads %s as its base64url", (_shape, iv) => {
      expect(
        coseWireHeader(new Map<CoseLabel, unknown>([[IV, iv]]), algKind).header.iv,
      ).toMatchSnapshot();
    });
  },
);
