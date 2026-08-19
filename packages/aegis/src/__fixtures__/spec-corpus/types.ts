/** Where an extract sits in its source: text lines, or HTML character offsets. */
export type ExtractSpan = {
  unit: "line" | "offset";
  start: number;
  end: number;
};

export type ExtractInput = {
  docId: string;
  section: string;
  source: string;
};

export type ExtractedSection = {
  heading: string;
  body: string;
  span: ExtractSpan;
};

export type SectionExtract = {
  /** `"rfc7519/section-4.1.3"`. */
  key: string;
  docId: string;
  section: string;
  /** Heading line as found in the source. */
  heading: string;
  /** Raw extract, subsections included. */
  body: string;
  /** Whitespace-collapsed body used for matching. */
  normalised: string;
};

export type CitationChecks = {
  /** Wire tokens the section body must name. */
  governs: Array<string>;
};

export type ManifestDocument = {
  url: string;
  title: string;
  /** sha256 of the WHOLE source document — an RFC changing it is an alarm. */
  sha256: string;
  fetchedAt: string;
};

export type ManifestSection = {
  docId: string;
  section: string;
  url: string;
  heading: string;
  span: ExtractSpan;
  sha256: string;
  bytes: number;
};

export type Manifest = {
  documents: Record<string, ManifestDocument>;
  sections: Record<string, ManifestSection>;
};

/** The hand-edited want-list: docId to the sections the corpus must carry. */
export type WantList = Record<string, Array<string>>;
