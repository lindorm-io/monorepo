import type { Dict } from "@lindorm/types";

/**
 * RFC 8417 — Security Event Token `events` claim. An object keyed by
 * event-type URI; each value is the event-type-specific payload object (which
 * may be empty, e.g. back-channel logout `{}`).
 *
 * https://www.rfc-editor.org/rfc/rfc8417#section-2.2
 */
export type SecurityEvents = Record<string, Dict>;

export const BACKCHANNEL_LOGOUT_EVENT_URI =
  "http://schemas.openid.net/event/backchannel-logout";

export const RTBF_EVENT_URI = "urn:lindorm:event:rtbf";
