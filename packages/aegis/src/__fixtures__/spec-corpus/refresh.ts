import { SpecCorpusError } from "./SpecCorpusError.js";
import { CORPUS_URL } from "./read-section.js";
import { refreshCorpus } from "./refresh-corpus.js";

const fetchText = async (url: string): Promise<string> => {
  const response = await fetch(url);

  if (response.ok === false) {
    throw new SpecCorpusError(`Fetch failed for ${url}`, {
      code: "fetch_failed",
      data: { url, status: response.status },
      title: "Spec Corpus Fetch Failed",
      details: "The source document could not be fetched, so nothing was written.",
    });
  }

  return response.text();
};

const report = await refreshCorpus({
  corpusUrl: CORPUS_URL,
  fetchText,
  prune: process.argv.includes("--prune"),
});

const lines = [
  ...report.documents.map(
    (document) =>
      `${document.changed ? "changed " : "        "}${document.docId}  ${document.title}`,
  ),
  `written ${report.written.length} · unchanged ${report.unchanged.length} · orphans ${report.orphans.length} · pruned ${report.pruned.length}`,
  ...report.orphans.map((key) => `orphan  ${key}  (run with --prune to delete)`),
];

process.stdout.write(`${lines.join("\n")}\n`);
