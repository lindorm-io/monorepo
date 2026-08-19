import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { assertPlausible } from "./assert-plausible.js";
import { extractRfcSection } from "./extract-rfc-section.js";

const PAGINATED = readFileSync(
  new URL("./__mini__/mini-rfc.txt", import.meta.url),
  "utf8",
);
const PLAIN = readFileSync(
  new URL("./__mini__/mini-rfc-v3.txt", import.meta.url),
  "utf8",
);

const extract = (section: string, source = PAGINATED) =>
  extractRfcSection({ docId: "rfc9999", section, source });

describe("extractRfcSection", () => {
  test("should extract a section with its subsections", () => {
    expect(extract("2")).toMatchSnapshot();
  });

  test("should read the same section out of the unpaginated format", () => {
    expect(extract("2", PLAIN).body).toEqual(extract("2").body);
  });

  // The table of contents lists `2.` with dot leaders. It is indented, so the
  // column-0 rule never sees it — were that not so, this section would be
  // ambiguous rather than extracted, which is the same failure as the recurring
  // heading below.
  test("should not mistake a table of contents entry for a heading", () => {
    expect(PAGINATED).toMatch(/^ +2\. {2}Claims \./m);
    expect(extract("2").heading).toEqual("2.  Claims");
    expect(extract("2").body).not.toMatch(/\.{4}/);
  });

  test("should end a section at a word heading", () => {
    expect(extract("5").body).toMatchSnapshot();
  });

  test("should refuse a section number that recurs at column 0", () => {
    expect(() => extract("3")).toThrow(
      expect.objectContaining({ code: "section_ambiguous" }),
    );
  });

  test("should refuse a section the document does not carry", () => {
    expect(() => extract("99.9")).toThrow(
      expect.objectContaining({ code: "section_not_found" }),
    );
  });

  test("should extract a heading with no body, which the floor then rejects", () => {
    const extracted = extract("4");

    expect(extracted.body).toEqual("4.  Empty");
    expect(() => assertPlausible("rfc9999/section-4", extracted.body)).toThrow(
      expect.objectContaining({ code: "extract_implausible" }),
    );
  });
});
