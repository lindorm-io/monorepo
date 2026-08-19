import { existsSync, readFileSync, readdirSync } from "node:fs";
import { specUrl } from "../../internal/registry/spec-citation.js";
import { SpecCorpusError } from "./SpecCorpusError.js";
import { assertPlausible } from "./assert-plausible.js";
import { toCitation } from "./document-urls.js";
import { readJson } from "./read-json.js";
import { sectionKey } from "./section-key.js";
import { sha256 } from "./sha256.js";
import type { Manifest, WantList } from "./types.js";

export type CorpusCensus = {
  keys: Array<string>;
  documents: Array<string>;
  bytes: number;
};

/**
 * The file census is a RECURSIVE readdir rather than a walk of the manifest, so
 * an extract cannot opt out of being checked by being new.
 */
const census = (corpusUrl: URL): Array<string> =>
  readdirSync(corpusUrl, { encoding: "utf8", recursive: true })
    .filter((name) => name.endsWith(".txt"))
    .map((name) => name.slice(0, -".txt".length))
    .sort();

const missing = (from: Array<string>, present: Array<string>): Array<string> =>
  from.filter((key) => present.includes(key) === false);

/**
 * Proves the committed corpus is exactly what the want-list asked for and
 * exactly what the manifest recorded: a bijection between want-list keys,
 * manifest rows and files on disk, every file matching its recorded hash and
 * clearing the plausibility floor.
 */
export const assertCorpusIntegrity = (corpusUrl: URL): CorpusCensus => {
  const absent = ["manifest.json", "sections.json"].filter(
    (name) => existsSync(new URL(name, corpusUrl)) === false,
  );

  if (absent.length > 0) {
    throw new SpecCorpusError(`Corpus is missing ${absent.join(", ")}`, {
      code: "corpus_incomplete",
      data: { corpus: corpusUrl.href, absent },
      title: "Spec Corpus Incomplete",
      details:
        "A corpus is its want-list plus its manifest; without both there is nothing to check the extracts against.",
    });
  }

  const want = readJson<WantList>(new URL("sections.json", corpusUrl));
  const manifest = readJson<Manifest>(new URL("manifest.json", corpusUrl));

  const wanted = Object.entries(want)
    .flatMap(([docId, sections]) => sections.map((section) => sectionKey(docId, section)))
    .sort();
  const rows = Object.keys(manifest.sections).sort();
  const files = census(corpusUrl);

  const documents = [
    ...new Set(Object.values(manifest.sections).map((row) => row.docId)),
  ];
  const discrepancies = {
    unmanifested: missing(wanted, rows),
    unwanted: missing(rows, wanted),
    absent: missing(rows, files),
    orphaned: missing(files, rows),
    undocumented: documents.filter(
      (docId) => Object.hasOwn(manifest.documents, docId) === false,
    ),
  };

  if (Object.values(discrepancies).some((list) => list.length > 0)) {
    throw new SpecCorpusError("Corpus is not the want-list", {
      code: "corpus_incomplete",
      data: discrepancies,
      title: "Spec Corpus Incomplete",
      details:
        "The want-list, the manifest and the files on disk must name exactly the same sections. Run the refresh script to bring them back into agreement.",
    });
  }

  let bytes = 0;

  for (const key of rows) {
    const row = manifest.sections[key];

    if (row === undefined) {
      continue;
    }

    const text = readFileSync(new URL(`${key}.txt`, corpusUrl), "utf8");
    const digest = sha256(text);

    if (digest !== row.sha256) {
      throw new SpecCorpusError(`Extract does not match its hash: ${key}`, {
        code: "corpus_tampered",
        data: { key, sha256: digest, expected: row.sha256 },
        title: "Spec Corpus Tampered",
        details:
          "An extract's content no longer hashes to what the manifest recorded, so the committed quote is not the fetched one. Refresh the corpus rather than editing an extract by hand.",
      });
    }

    const derived = specUrl(toCitation(row.docId, row.section));

    if (row.url !== derived) {
      throw new SpecCorpusError(`Url mismatch for ${key}`, {
        code: "url_mismatch",
        data: { key, url: row.url, derived },
        title: "Spec Corpus Url Mismatch",
        details:
          "A manifest row's url is not the one its document and section derive, so the recorded link points somewhere the key does not.",
      });
    }

    assertPlausible(key, text.trimEnd());

    bytes += text.length;
  }

  return { keys: rows, documents: Object.keys(manifest.documents).sort(), bytes };
};
