/**
 * OIDC Core §3.1.2.1 `display` values. A CLOSED set — the spec enumerates
 * exactly these four, so the derived type carries no open-string escape hatch.
 */
export const DisplayMode = {
  /** wire: `page` — full User Agent page view (the default) */
  Page: "page",
  /** wire: `popup` — popup User Agent window */
  Popup: "popup",
  /** wire: `touch` — touch interface */
  Touch: "touch",
  /** wire: `wap` — "feature phone" type display */
  Wap: "wap",
} as const;

export type DisplayMode = (typeof DisplayMode)[keyof typeof DisplayMode];
