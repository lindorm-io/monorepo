const HTML_TITLE = /<title>([\s\S]*?)<\/title>/i;
const ABSTRACT = /^Abstract\s*$/;
const CENTRED = /^\s{4,}\S/;

/**
 * The RFC title is the centred block that closes the front matter, immediately
 * above `Abstract` — the one place both the paginated and the newer text format
 * spell it the same way.
 */
const rfcTitle = (source: string): string => {
  const lines = source.split("\n");
  const abstract = lines.findIndex((line) => ABSTRACT.test(line));
  const front = lines.slice(0, abstract < 0 ? lines.length : abstract);
  const title: Array<string> = [];

  for (let index = front.length - 1; index >= 0; index--) {
    const line = front[index] ?? "";

    if (line.trim() === "") {
      if (title.length > 0) break;
      continue;
    }
    if (CENTRED.test(line) === false) break;

    title.unshift(line.trim());
  }

  return title.join(" ").replace(/\s+/g, " ");
};

const oidcTitle = (source: string): string =>
  (HTML_TITLE.exec(source)?.[1] ?? "").replace(/\s+/g, " ").trim();

/** The document title AS FETCHED — an errata set is part of what was read. */
export const documentTitle = (kind: "oidc" | "rfc", source: string): string =>
  kind === "rfc" ? rfcTitle(source) : oidcTitle(source);
