import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, test } from "vitest";
import { assertCorpusIntegrity } from "./assert-corpus-integrity.js";
import { toCitation } from "./document-urls.js";
import { readSection } from "./read-section.js";
import { refreshCorpus } from "./refresh-corpus.js";
import type { FetchText } from "./refresh-corpus.js";
import type { Manifest, WantList } from "./types.js";

const read = (name: string): string =>
  readFileSync(new URL(`./__mini__/${name}`, import.meta.url), "utf8");

const MINI_RFC = read("mini-rfc.txt");
const MINI_OIDC = read("mini-oidc.html");
const NOW = new Date("2026-01-01T00:00:00.000Z");

const fetching =
  (rfc = MINI_RFC, oidc = MINI_OIDC): FetchText =>
  async (url) =>
    url.endsWith(".txt") ? rfc : oidc;

const corpus = (want: WantList): URL => {
  const directory = mkdtempSync(join(tmpdir(), "spec-corpus-"));

  writeFileSync(join(directory, "sections.json"), JSON.stringify(want), "utf8");

  return pathToFileURL(`${directory}/`);
};

const manifestOf = (corpusUrl: URL): Manifest =>
  JSON.parse(readFileSync(new URL("manifest.json", corpusUrl), "utf8")) as Manifest;

const WANT: WantList = { "openid-connect-core-1_0": ["2"], rfc9999: ["2"] };

describe("refreshCorpus", () => {
  test("should write every wanted section with its manifest row", async () => {
    const corpusUrl = corpus(WANT);
    const report = await refreshCorpus({ corpusUrl, fetchText: fetching(), now: NOW });

    expect(report).toMatchSnapshot();
    expect(manifestOf(corpusUrl)).toMatchSnapshot();
    expect(readSection(toCitation("rfc9999", "2"), corpusUrl).heading).toEqual(
      "2.  Claims",
    );
    expect(assertCorpusIntegrity(corpusUrl).keys).toEqual([
      "openid-connect-core-1_0/section-2",
      "rfc9999/section-2",
    ]);
  });

  test("should rewrite nothing on a second run of the same sources", async () => {
    const corpusUrl = corpus(WANT);

    await refreshCorpus({ corpusUrl, fetchText: fetching(), now: NOW });

    const report = await refreshCorpus({
      corpusUrl,
      fetchText: fetching(),
      now: new Date("2027-01-01T00:00:00.000Z"),
    });

    expect(report.written).toEqual([]);
    expect(report.unchanged).toHaveLength(2);
    expect(manifestOf(corpusUrl).documents["rfc9999"]?.fetchedAt).toEqual("2026-01-01");
  });

  // The plain-text RFC format is immutable, so a different document under the
  // same number is an alarm rather than an update.
  test("should refuse an rfc source that changed", async () => {
    const corpusUrl = corpus(WANT);

    await refreshCorpus({ corpusUrl, fetchText: fetching(), now: NOW });

    await expect(
      refreshCorpus({
        corpusUrl,
        fetchText: fetching(`${MINI_RFC}\n   An amendment nobody can make.\n`),
        now: NOW,
      }),
    ).rejects.toThrow(expect.objectContaining({ code: "document_changed" }));
  });

  // openid.net documents do drift with errata, so the change is reported rather
  // than refused.
  test("should report an openid source that changed", async () => {
    const corpusUrl = corpus(WANT);

    await refreshCorpus({ corpusUrl, fetchText: fetching(), now: NOW });

    const report = await refreshCorpus({
      corpusUrl,
      fetchText: fetching(MINI_RFC, MINI_OIDC.replace("errata set 1", "errata set 2")),
      now: NOW,
    });

    expect(report.documents).toEqual([
      expect.objectContaining({ docId: "openid-connect-core-1_0", changed: true }),
      expect.objectContaining({ docId: "rfc9999", changed: false }),
    ]);
  });

  // At fetch: nothing that fails extraction or the floor reaches the disk.
  test.each([
    ["3", "section_ambiguous"],
    ["4", "extract_implausible"],
    ["99.9", "section_not_found"],
  ])("should write nothing for section %s", async (section, code) => {
    const corpusUrl = corpus({ rfc9999: [section] });

    await expect(
      refreshCorpus({ corpusUrl, fetchText: fetching(), now: NOW }),
    ).rejects.toThrow(expect.objectContaining({ code }));

    expect(existsSync(new URL(`rfc9999/section-${section}.txt`, corpusUrl))).toBe(false);
  });

  test("should refuse a document the citation union does not name", async () => {
    const corpusUrl = corpus({ "draft-mini-00": ["2"] });

    await expect(
      refreshCorpus({ corpusUrl, fetchText: fetching(), now: NOW }),
    ).rejects.toThrow(expect.objectContaining({ code: "document_unknown" }));
  });

  test("should report an orphan extract and delete it only when pruning", async () => {
    const corpusUrl = corpus(WANT);

    await refreshCorpus({ corpusUrl, fetchText: fetching(), now: NOW });
    writeFileSync(new URL("rfc9999/section-1.txt", corpusUrl), "stray\n", "utf8");

    const kept = await refreshCorpus({ corpusUrl, fetchText: fetching(), now: NOW });

    expect(kept.orphans).toEqual(["rfc9999/section-1"]);
    expect(kept.pruned).toEqual([]);
    expect(existsSync(new URL("rfc9999/section-1.txt", corpusUrl))).toBe(true);

    const pruned = await refreshCorpus({
      corpusUrl,
      fetchText: fetching(),
      now: NOW,
      prune: true,
    });

    expect(pruned.pruned).toEqual(["rfc9999/section-1"]);
    expect(existsSync(new URL("rfc9999/section-1.txt", corpusUrl))).toBe(false);
  });
});
