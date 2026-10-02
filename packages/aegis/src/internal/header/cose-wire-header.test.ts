import { describe, expect, test } from "vitest";
import { CoseError } from "../../errors/index.js";
import { Tag } from "../cose/cbor.js";
import type { CoseLabel } from "../cose/cose-label.js";
import { type CoseAlgKind, coseWireHeader } from "./cose-wire-header.js";
import { coseByJose } from "./header-registry.js";

const TYP = coseByJose("typ");

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

    // The empty string included: the read reports what a producer wrote, and the
    // per-family typ gate is what refuses an empty one (`CwsKit.test.ts`).
    test.each([["application/at+cwt"], ["application/cws"], [""]])(
      "passes the text typ %j through unchanged",
      (typ) => {
        expect(
          coseWireHeader(new Map<CoseLabel, unknown>([[TYP, typ]]), algKind).header.typ,
        ).toBe(typ);
      },
    );
  },
);
