/** The corpus key AND, with a `.txt` suffix, the file it lives in. */
export const sectionKey = (docId: string, section: string): string =>
  `${docId}/section-${section}`;
