import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { specUrl } from "../../internal/registry/spec-citation.js";
import { SpecCorpusError } from "./SpecCorpusError.js";
import { assertPlausible } from "./assert-plausible.js";
import { documentKind, sourceUrl, toCitation } from "./document-urls.js";
import { documentTitle } from "./document-title.js";
import { extractOidcSection } from "./extract-oidc-section.js";
import { extractRfcSection } from "./extract-rfc-section.js";
import { readJson } from "./read-json.js";
import { sectionKey } from "./section-key.js";
import { sha256 } from "./sha256.js";
import type { Manifest, ManifestSection, WantList } from "./types.js";

export type FetchText = (url: string) => Promise<string>;

export type RefreshOptions = {
  corpusUrl: URL;
  fetchText: FetchText;
  now?: Date;
  prune?: boolean;
};

export type RefreshedDocument = {
  docId: string;
  title: string;
  sha256: string;
  /** The source document differs from the one the manifest recorded. */
  changed: boolean;
};

export type RefreshReport = {
  documents: Array<RefreshedDocument>;
  written: Array<string>;
  unchanged: Array<string>;
  orphans: Array<string>;
  pruned: Array<string>;
};

const EMPTY: Manifest = { documents: {}, sections: {} };

/** `4.1.10` sorts after `4.1.9`, which a lexical sort gets backwards. */
const compareSections = (left: string, right: string): number => {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);

  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    const diff = (a[index] ?? -1) - (b[index] ?? -1);

    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
};

const extract = (kind: "oidc" | "rfc", docId: string, section: string, source: string) =>
  kind === "rfc"
    ? extractRfcSection({ docId, section, source })
    : extractOidcSection({ docId, section, source });

/**
 * Fetches every section the want-list asks for and writes it, with a manifest
 * row, into the corpus. `fetchText` is injected: the pipeline itself never
 * touches the network, so it is covered offline.
 *
 * Nothing is written that fails extraction or the plausibility floor, and an RFC
 * whose source document changed is an ALARM — that format is immutable, so a
 * different document under the same number means something is wrong upstream,
 * not that the corpus is stale.
 */
export const refreshCorpus = async ({
  corpusUrl,
  fetchText,
  now = new Date(),
  prune = false,
}: RefreshOptions): Promise<RefreshReport> => {
  const manifestUrl = new URL("manifest.json", corpusUrl);
  const want = readJson<WantList>(new URL("sections.json", corpusUrl));
  const previous = existsSync(manifestUrl) ? readJson<Manifest>(manifestUrl) : EMPTY;

  const manifest: Manifest = { documents: {}, sections: {} };
  const report: RefreshReport = {
    documents: [],
    written: [],
    unchanged: [],
    orphans: [],
    pruned: [],
  };
  const fetchedAt = now.toISOString().slice(0, 10);

  for (const docId of Object.keys(want).sort()) {
    const kind = documentKind(docId);
    const url = sourceUrl(docId);
    const source = await fetchText(url);
    const digest = sha256(source);
    const before = previous.documents[docId];
    const changed = before !== undefined && before.sha256 !== digest;

    if (changed && kind === "rfc") {
      throw new SpecCorpusError(`Source document changed: ${docId}`, {
        code: "document_changed",
        data: { docId, sha256: digest, expected: before?.sha256 },
        title: "Spec Corpus Document Changed",
        details:
          "The plain-text RFC format is immutable, so a different hash under the same number is an alarm rather than an update. Investigate the source before touching the corpus.",
      });
    }

    manifest.documents[docId] = {
      url,
      title: documentTitle(kind, source),
      sha256: digest,
      fetchedAt: changed || before === undefined ? fetchedAt : before.fetchedAt,
    };
    report.documents.push({
      docId,
      title: manifest.documents[docId].title,
      sha256: digest,
      changed,
    });

    mkdirSync(new URL(`${docId}/`, corpusUrl), { recursive: true });

    for (const section of [...(want[docId] ?? [])].sort(compareSections)) {
      const key = sectionKey(docId, section);
      const extracted = extract(kind, docId, section, source);
      const text = `${extracted.body}\n`;

      assertPlausible(key, extracted.body);

      const file = new URL(`${key}.txt`, corpusUrl);
      const isCurrent =
        existsSync(file) && readFileSync(file, "utf8") === text ? "unchanged" : "written";

      if (isCurrent === "written") {
        writeFileSync(file, text, "utf8");
      }

      report[isCurrent].push(key);

      const row: ManifestSection = {
        docId,
        section,
        url: specUrl(toCitation(docId, section)),
        heading: extracted.heading,
        span: extracted.span,
        sha256: sha256(text),
        bytes: text.length,
      };

      manifest.sections[key] = row;
    }
  }

  const wanted = Object.keys(manifest.sections);

  for (const name of readdirSync(corpusUrl, { encoding: "utf8", recursive: true })) {
    const key = name.endsWith(".txt") ? name.slice(0, -".txt".length) : null;

    if (key === null || wanted.includes(key)) {
      continue;
    }

    report[prune ? "pruned" : "orphans"].push(key);

    if (prune) {
      rmSync(new URL(`${key}.txt`, corpusUrl));
    }
  }

  writeFileSync(manifestUrl, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return report;
};
