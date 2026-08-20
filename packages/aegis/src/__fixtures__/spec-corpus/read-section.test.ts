import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, test } from "vitest";
import { toCitation } from "./document-urls.js";
import { readSection } from "./read-section.js";

const truncatedCorpus = (): URL => {
  const directory = mkdtempSync(join(tmpdir(), "spec-corpus-"));

  mkdirSync(join(directory, "rfc7519"));
  writeFileSync(
    join(directory, "rfc7519", "section-4.1.3.txt"),
    '4.1.3.  "aud"\n',
    "utf8",
  );

  return pathToFileURL(`${directory}/`);
};

describe("readSection", () => {
  test("should read a committed rfc extract", () => {
    const extract = readSection(toCitation("rfc7519", "4.1.3"));

    expect({ ...extract, body: undefined, normalised: undefined }).toMatchSnapshot();
    expect(extract.body).toContain(
      'The "aud" (audience) claim identifies the recipients that the JWT is',
    );
    expect(extract.normalised).toContain("intended for. Each principal");
  });

  test("should read a committed openid extract", () => {
    const extract = readSection(toCitation("openid-connect-core-1_0", "5.1.1"));

    expect({ ...extract, body: undefined, normalised: undefined }).toMatchSnapshot();
    expect(extract.body).toContain(
      "The Address Claim represents a physical mailing address",
    );
  });

  // The corpus has no directory for the document at all.
  test("should refuse a document the corpus does not carry", () => {
    expect(() => readSection(toCitation("rfc9999", "1"))).toThrow(
      expect.objectContaining({ code: "document_unknown" }),
    );
  });

  // The document is present, the cited section is not.
  test("should refuse a section the corpus does not carry", () => {
    expect(() => readSection(toCitation("rfc7519", "99.9"))).toThrow(
      expect.objectContaining({ code: "section_missing" }),
    );
  });

  // A url that is not the one the citation derives means the link and the
  // section number have drifted apart.
  test("should refuse a url the citation does not derive", () => {
    const citation = {
      ...toCitation("rfc7519", "4.1.3"),
      url: "https://example.com/aud",
    };

    expect(() => readSection(citation)).toThrow(
      expect.objectContaining({ code: "url_mismatch" }),
    );
  });

  // On the READ side: a committed extract truncated after it was fetched must
  // not pass just because the file exists.
  test("should refuse a truncated extract on read", () => {
    expect(() => readSection(toCitation("rfc7519", "4.1.3"), truncatedCorpus())).toThrow(
      expect.objectContaining({ code: "extract_implausible" }),
    );
  });
});
