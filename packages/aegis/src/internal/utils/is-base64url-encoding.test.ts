import { describe, expect, test } from "vitest";
import { isBase64UrlEncoding } from "./is-base64url-encoding.js";

describe("isBase64UrlEncoding", () => {
  test.each([
    ["the empty string, which encodes zero octets", ""],
    ["two characters, which encode one octet", "AA"],
    ["three characters, which encode two octets", "AAA"],
    ["four characters, which encode three octets", "AAAA"],
    ["the URL-safe hyphen and underscore", "-_-_"],
    ["a twelve-octet nonce", Buffer.alloc(12, 0xfb).toString("base64url")],
  ])("accepts %s", (_shape, value) => {
    expect(isBase64UrlEncoding(value)).toBe(true);
  });

  test.each([
    ["a character outside the alphabet", "!!!"],
    ["a plus sign, which only the standard alphabet has", "AA+A"],
    ["a slash, which only the standard alphabet has", "AA/A"],
    ["padding", "AA=="],
    ["a single trailing pad", "AAA="],
    ["a space", "AA AAA"],
    ["a line break", "AAAA\nAAA"],
    ["a length no octet sequence encodes to", "A"],
    ["five characters", "AAAAA"],
  ])("refuses %s", (_shape, value) => {
    expect(isBase64UrlEncoding(value)).toBe(false);
  });

  test.each([
    ["a number", 5],
    ["zero", 0],
    ["false", false],
    ["null", null],
    ["undefined", undefined],
    ["an array", ["AAAA"]],
    ["an object", { value: "AAAA" }],
    ["a Buffer", Buffer.from("AAAA")],
  ])("refuses %s, which is not a string", (_shape, value) => {
    expect(isBase64UrlEncoding(value)).toBe(false);
  });
});
