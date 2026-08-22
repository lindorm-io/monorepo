import type { Dict } from "@lindorm/types";

/**
 * The RFC 8417 §2.2 `events` claim: keyed by event-type URI, each value the
 * event-type-specific payload object — which may be empty (`{}`).
 */
export type SecurityEvents = Record<string, Dict>;

export const BACKCHANNEL_LOGOUT_EVENT_URI =
  "http://schemas.openid.net/event/backchannel-logout";

export const RTBF_EVENT_URI = "urn:lindorm:event:rtbf";
