import { describe, expect, test } from "vitest";
import { keyIdFromBytes } from "./key-id-from-bytes.js";

describe("keyIdFromBytes", () => {
  const bytes = Buffer.from("000102030405060708090a0b0c0d0e0f10111213", "hex");

  test("maps the leading 16 bytes to a stable `key_` base62 id", () => {
    expect(keyIdFromBytes(bytes)).toMatchSnapshot();
  });

  test("produces the `key_` + 16 base62 char shape", () => {
    expect(keyIdFromBytes(bytes)).toMatch(/^key_[A-Za-z0-9]{16}$/);
  });

  test("is deterministic", () => {
    expect(keyIdFromBytes(bytes)).toBe(keyIdFromBytes(Buffer.from(bytes)));
  });

  test("honours an explicit length", () => {
    expect(keyIdFromBytes(bytes, 8)).toMatch(/^key_[A-Za-z0-9]{8}$/);
  });

  test("only the leading `length` bytes affect the id", () => {
    const head = bytes.subarray(0, 16);
    const a = Buffer.concat([head, Buffer.from([0xff, 0xff, 0xff])]);
    const b = Buffer.concat([head, Buffer.from([0x00, 0x00, 0x00])]);

    expect(keyIdFromBytes(a)).toBe(keyIdFromBytes(b));
  });
});
