import { isVerbatimKey } from "./is-verbatim-key.js";
import { describe, expect, test } from "vitest";

describe("isVerbatimKey", () => {
  test("x5t#S256 is verbatim", () => {
    expect(isVerbatimKey("x5t#S256")).toBe(true);
  });

  test("a namespaced claim key is verbatim", () => {
    expect(isVerbatimKey("https://claims.lindorm.io/tenant")).toBe(true);
  });

  test("a header-cased key with a hyphen is verbatim", () => {
    expect(isVerbatimKey("X-Request-Id")).toBe(true);
  });

  test("a dotted key is verbatim", () => {
    expect(isVerbatimKey("a.b")).toBe(true);
  });

  test("a urn key is verbatim", () => {
    expect(isVerbatimKey("urn:lindorm:tenant")).toBe(true);
  });

  test("a key with a space is verbatim", () => {
    expect(isVerbatimKey("lower case")).toBe(true);
  });

  test("a superscript digit key is verbatim", () => {
    expect(isVerbatimKey("m²")).toBe(true);
  });

  test("a JSON Schema $ref key is verbatim", () => {
    expect(isVerbatimKey("$ref")).toBe(true);
  });

  test("a JSON-LD @context key is verbatim", () => {
    expect(isVerbatimKey("@context")).toBe(true);
  });

  test("a key with a plus is verbatim", () => {
    expect(isVerbatimKey("a+b")).toBe(true);
  });

  test("a key with a tilde is verbatim", () => {
    expect(isVerbatimKey("a~b")).toBe(true);
  });

  test("a camelCase key is not verbatim", () => {
    expect(isVerbatimKey("camelCaseTwo")).toBe(false);
  });

  test("a PascalCase key is not verbatim", () => {
    expect(isVerbatimKey("PascalCaseTwo")).toBe(false);
  });

  test("a snake_case key is not verbatim", () => {
    expect(isVerbatimKey("snake_case_two")).toBe(false);
  });

  test("a mixed_camelCase key is not verbatim", () => {
    expect(isVerbatimKey("mixed_camelCase")).toBe(false);
  });

  test("a digit-bearing camelCase key is not verbatim", () => {
    expect(isVerbatimKey("x5tS256")).toBe(false);
  });

  test("a CONSTANT_CASE key is not verbatim", () => {
    expect(isVerbatimKey("CONSTANT_CASE")).toBe(false);
  });

  test("a non-ASCII letter key is not verbatim", () => {
    expect(isVerbatimKey("färgKod")).toBe(false);
  });

  test("a digit-only key is not verbatim", () => {
    expect(isVerbatimKey("123")).toBe(false);
  });

  test("an empty key is not verbatim", () => {
    expect(isVerbatimKey("")).toBe(false);
  });
});
