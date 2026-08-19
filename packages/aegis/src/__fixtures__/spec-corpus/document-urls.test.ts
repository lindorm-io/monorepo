import { describe, expect, test } from "vitest";
import { documentKind, sourceUrl, toCitation } from "./document-urls.js";

describe("toCitation", () => {
  test("should derive an rfc citation and its url", () => {
    expect(toCitation("rfc7519", "4.1.3")).toMatchSnapshot();
  });

  test("should derive an openid citation and its url", () => {
    expect(toCitation("openid-connect-core-1_0", "5.1")).toMatchSnapshot();
  });

  test("should refuse a document the citation union does not name", () => {
    expect(() => toCitation("draft-mini-00", "1")).toThrow(
      expect.objectContaining({ code: "document_unknown" }),
    );
  });
});

describe("sourceUrl", () => {
  test.each([
    ["rfc7519", "https://www.rfc-editor.org/rfc/rfc7519.txt"],
    ["openid-connect-core-1_0", "https://openid.net/specs/openid-connect-core-1_0.html"],
  ])("should point %s at its whole document", (docId, expected) => {
    expect(sourceUrl(docId)).toEqual(expected);
  });

  test("should refuse a document the citation union does not name", () => {
    expect(() => sourceUrl("draft-mini-00")).toThrow(
      expect.objectContaining({ code: "document_unknown" }),
    );
  });
});

describe("documentKind", () => {
  test.each([
    ["rfc7519", "rfc"],
    ["openid-connect-core-1_0", "oidc"],
  ])("should read %s as %s", (docId, expected) => {
    expect(documentKind(docId)).toEqual(expected);
  });

  test("should refuse a document the citation union does not name", () => {
    expect(() => documentKind("draft-mini-00")).toThrow(
      expect.objectContaining({ code: "document_unknown" }),
    );
  });
});
