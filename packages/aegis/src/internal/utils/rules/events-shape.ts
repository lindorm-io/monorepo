import { isObject } from "@lindorm/is";
import { isUrlLike } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import type { InvalidEntry } from "../../../types/index.js";
import { isClaimOmitted } from "./is-claim-omitted.js";
import { isClaimSatisfied } from "./is-claim-satisfied.js";

// URN-form event types (e.g. urn:lindorm:event:rtbf) are valid event-type
// identifiers but are not URLs; accept either a URL or a URN.
const isEventTypeUri = (key: string): boolean =>
  isUrlLike(key) || /^urn:[a-z0-9][a-z0-9-]{0,31}:\S+$/i.test(key);

/**
 * RFC 8417 — when `events` is present it must be an object keyed by
 * event-type URI, each value an object (which may be empty, e.g. back-channel
 * logout `{}`).
 */
export const eventsShape = (claims: Dict): Array<InvalidEntry> => {
  const value = claims.events;

  if (isClaimOmitted(value)) return [];

  if (!isObject(value)) {
    return [{ key: "events", message: "events must be an object" }];
  }

  const events = value;

  // The DEMAND question, spelled as the rules layer spells it — a hand-written
  // key count here is the same notion under a different name, and `rules/index.ts`
  // leans on this refusal by name when it says `events` covers its own empty form.
  if (!isClaimSatisfied(events)) {
    return [{ key: "events", message: "events must contain at least one event type" }];
  }

  const keys = Object.keys(events);

  const invalid: Array<InvalidEntry> = [];

  for (const key of keys) {
    if (!isEventTypeUri(key)) {
      invalid.push({
        key: `events.${key}`,
        message: `event type "${key}" must be a URI`,
      });
    }
    if (!isObject(events[key])) {
      invalid.push({
        key: `events.${key}`,
        message: `event "${key}" payload must be an object`,
      });
    }
  }

  return invalid;
};
