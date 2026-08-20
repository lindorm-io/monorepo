import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, test } from "vitest";
import { assertCorpusIntegrity } from "./assert-corpus-integrity.js";
import { CORPUS_URL } from "./read-section.js";
import { sectionKey } from "./section-key.js";
import { sha256 } from "./sha256.js";
import type { Manifest, WantList } from "./types.js";

const WANT = JSON.parse(
  readFileSync(new URL("sections.json", CORPUS_URL), "utf8"),
) as WantList;

const KEYS = Object.entries(WANT)
  .flatMap(([docId, sections]) => sections.map((section) => sectionKey(docId, section)))
  .sort();

/** A copy, so a red case never mutates the committed corpus. */
const copy = (): URL => {
  const directory = join(mkdtempSync(join(tmpdir(), "spec-corpus-")), "rfc");

  cpSync(CORPUS_URL, pathToFileURL(`${directory}/`), { recursive: true });

  return pathToFileURL(`${directory}/`);
};

const rewrite = (corpusUrl: URL, edit: (manifest: Manifest) => void): void => {
  const url = new URL("manifest.json", corpusUrl);
  const manifest = JSON.parse(readFileSync(url, "utf8")) as Manifest;

  edit(manifest);
  writeFileSync(url, JSON.stringify(manifest, null, 2), "utf8");
};

describe("the committed corpus", () => {
  test("should hold exactly the sections the want-list asks for", () => {
    const census = assertCorpusIntegrity(CORPUS_URL);

    expect(census.keys).toEqual(KEYS);
    expect(census.documents).toEqual(Object.keys(WANT).sort());
    expect(census.bytes).toBeGreaterThan(0);
  });
});

describe("assertCorpusIntegrity", () => {
  // The census is a recursive readdir, so a file cannot opt out of the
  // check by being new, and neither side of the bijection may be short.
  test("should refuse an extract nobody asked for", () => {
    const corpusUrl = copy();

    writeFileSync(new URL("rfc7519/section-9.9.txt", corpusUrl), "stray\n", "utf8");

    expect(() => assertCorpusIntegrity(corpusUrl)).toThrow(
      expect.objectContaining({ code: "corpus_incomplete" }),
    );
  });

  test("should refuse a manifest row with no file", () => {
    const corpusUrl = copy();

    rmSync(new URL("rfc7519/section-4.1.3.txt", corpusUrl));

    expect(() => assertCorpusIntegrity(corpusUrl)).toThrow(
      expect.objectContaining({ code: "corpus_incomplete" }),
    );
  });

  test("should refuse a want-list key with no manifest row", () => {
    const corpusUrl = copy();

    rewrite(corpusUrl, (manifest) => {
      delete manifest.sections["rfc7519/section-4.1.3"];
    });

    expect(() => assertCorpusIntegrity(corpusUrl)).toThrow(
      expect.objectContaining({ code: "corpus_incomplete" }),
    );
  });

  test("should refuse a corpus with no manifest", () => {
    const corpusUrl = copy();

    rmSync(new URL("manifest.json", corpusUrl));

    expect(() => assertCorpusIntegrity(corpusUrl)).toThrow(
      expect.objectContaining({ code: "corpus_incomplete" }),
    );
  });

  // An extract edited by hand is no longer the fetched text.
  test("should refuse an extract that no longer matches its hash", () => {
    const corpusUrl = copy();
    const url = new URL("rfc7519/section-4.1.3.txt", corpusUrl);

    writeFileSync(url, readFileSync(url, "utf8").replace("MUST", "MAY"), "utf8");

    expect(() => assertCorpusIntegrity(corpusUrl)).toThrow(
      expect.objectContaining({ code: "corpus_tampered" }),
    );
  });

  // A truncated extract whose hash was updated to match still fails, so
  // rewriting the manifest is not a way past the floor.
  test("should refuse a truncated extract even with a matching hash", () => {
    const corpusUrl = copy();
    const url = new URL("rfc7519/section-4.1.3.txt", corpusUrl);
    const text = '4.1.3.  "aud" (Audience) Claim\n';

    writeFileSync(url, text, "utf8");
    rewrite(corpusUrl, (manifest) => {
      const row = manifest.sections["rfc7519/section-4.1.3"];

      if (row) {
        row.sha256 = sha256(text);
        row.bytes = text.length;
      }
    });

    expect(() => assertCorpusIntegrity(corpusUrl)).toThrow(
      expect.objectContaining({ code: "extract_implausible" }),
    );
  });

  // A recorded url that its own key does not derive.
  test("should refuse a manifest url the key does not derive", () => {
    const corpusUrl = copy();

    rewrite(corpusUrl, (manifest) => {
      const row = manifest.sections["rfc7519/section-4.1.3"];

      if (row) {
        row.url = "https://www.rfc-editor.org/rfc/rfc7519#section-4.1.4";
      }
    });

    expect(() => assertCorpusIntegrity(corpusUrl)).toThrow(
      expect.objectContaining({ code: "url_mismatch" }),
    );
  });
});
