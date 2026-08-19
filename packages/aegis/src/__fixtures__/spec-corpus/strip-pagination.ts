const PAGE_FOOTER = /\[Page \d+\]\s*$/;
const RUNNING_HEADER = /\s{2,}\S/;
const RUNNING_HEADER_YEAR = /\d{4}\s*$/;

const stripPage = (page: string, index: number): string => {
  const lines = page.split("\n");

  // Blank-then-footer and footer-then-blank both occur, so the two are popped in
  // one loop rather than in a fixed order.
  while (
    lines.length > 0 &&
    (PAGE_FOOTER.test(lines.at(-1) ?? "") || (lines.at(-1) ?? "").trim() === "")
  ) {
    lines.pop();
  }

  if (index === 0) {
    return lines.join("\n");
  }

  while (lines.length > 0 && (lines[0] ?? "").trim() === "") {
    lines.shift();
  }

  // Every page but the first opens with the running header — indented columns
  // closing on the publication year. Dropping it keeps a heading from landing
  // mid-page with furniture above it.
  if (RUNNING_HEADER.test(lines[0] ?? "") && RUNNING_HEADER_YEAR.test(lines[0] ?? "")) {
    lines.shift();
  }

  return lines.join("\n");
};

/**
 * Removes page furniture from the paginated RFC text format. Documents in the
 * newer format carry no form feeds and are returned untouched.
 */
export const stripPagination = (text: string): string =>
  text.includes("\f") ? text.split("\f").map(stripPage).join("\n") : text;
