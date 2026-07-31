import { describe, expect, test } from "vitest";
import { parseBasicCredentials } from "./parse-basic-credentials.js";

const encode = (value: string): string => Buffer.from(value).toString("base64");

describe("parseBasicCredentials", () => {
  test("should parse a plain username and password", () => {
    expect(parseBasicCredentials(encode("admin:secret"))).toMatchSnapshot();
  });

  test("should keep a password containing colons intact (RFC 7617)", () => {
    expect(parseBasicCredentials(encode("admin:pa:ss:word"))).toMatchSnapshot();
  });

  test("should keep a password that is only colons intact", () => {
    expect(parseBasicCredentials(encode("admin:::"))).toMatchSnapshot();
  });

  test("should decode urlencoded credentials (RFC 6749 Section 2.3.1)", () => {
    expect(
      parseBasicCredentials(encode("client%20id:s%3Ecret%2Fvalue%26more")),
    ).toMatchSnapshot();
  });

  test("should decode + as a space (form-urlencoded, RFC 6749 Section 2.3.1)", () => {
    expect(parseBasicCredentials(encode("my+client:pa+ss word"))).toMatchSnapshot();
  });

  test("should decode an urlencoded colon in the password without splitting on it", () => {
    expect(
      parseBasicCredentials(encode("client:secret%3Awith%3Acolons")),
    ).toMatchSnapshot();
  });

  test("should keep a half that is not valid percent-encoding verbatim", () => {
    expect(parseBasicCredentials(encode("admin:100%pure"))).toMatchSnapshot();
  });

  test("should parse an empty password", () => {
    expect(parseBasicCredentials(encode("admin:"))).toMatchSnapshot();
  });

  test("should parse an empty username", () => {
    expect(parseBasicCredentials(encode(":secret"))).toMatchSnapshot();
  });

  test("should return null when there is no colon", () => {
    expect(parseBasicCredentials(encode("nocolonhere"))).toBeNull();
  });

  test("should return null for an empty credential", () => {
    expect(parseBasicCredentials("")).toBeNull();
  });

  test("should return null rather than throw on invalid base64", () => {
    expect(parseBasicCredentials("!!!not-base64!!!")).toBeNull();
  });
});
