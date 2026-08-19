import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { extractOidcSection } from "./extract-oidc-section.js";

const SOURCE = readFileSync(
  new URL("./__mini__/mini-oidc.html", import.meta.url),
  "utf8",
);

const extract = (section: string) =>
  extractOidcSection({ docId: "openid-connect-core-1_0", section, source: SOURCE });

describe("extractOidcSection", () => {
  test("should extract a section with its subsections", () => {
    expect(extract("2")).toMatchSnapshot();
  });

  test("should extract a subsection on its own", () => {
    expect(extract("2.1")).toMatchSnapshot();
  });

  test("should decode entities and fold typography to its ascii look-alike", () => {
    const { body } = extract("2");

    expect(body).toMatch(/"mini" Claim/);
    expect(body).toMatch(/non-breaking hyphen/);
    expect(body).not.toMatch(/&\w+;/);
  });

  test("should refuse a section number carried by more than one anchor", () => {
    expect(() => extract("4")).toThrow(
      expect.objectContaining({ code: "section_ambiguous" }),
    );
  });

  test("should refuse a section the document does not carry", () => {
    expect(() => extract("99.9")).toThrow(
      expect.objectContaining({ code: "section_not_found" }),
    );
  });

  test("should fall back to the first line when an anchor carries no heading", () => {
    const extracted = extract("6");

    expect(extracted.heading).toEqual(
      "An anchor with no heading element still yields a section, whose heading is",
    );
    expect(extracted.body.startsWith(extracted.heading)).toBe(true);
  });

  // An entity nobody decoded would be committed as markup, which is the corpus
  // carrying something the document does not say.
  test("should refuse an entity the table has no character for", () => {
    expect(() => extract("5")).toThrow(
      expect.objectContaining({ code: "entity_unknown" }),
    );
  });
});
