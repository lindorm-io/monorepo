export type DocStringSettings = {
  /** The DocString body verbatim — indentation stripped by the parser, nothing else touched. */
  content: string;
  /** The word after the opening delimiter (`"""json`) — absent when the author wrote none. */
  mediaType?: string;
};
