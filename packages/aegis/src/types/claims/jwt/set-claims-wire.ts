import type { Dict } from "@lindorm/types";

// Wire form of the Security Event Token claims (RFC 8417 / RFC 9493).
//   - `sub_id`  — RFC 9493 Subject Identifier object (`format` + members)
//   - `events`  — RFC 8417 events object keyed by event-type URI
//   - `txn`     — RFC 8417 transaction identifier
//
// https://www.rfc-editor.org/rfc/rfc8417
// https://www.rfc-editor.org/rfc/rfc9493
export type SetClaimsWire = {
  events?: Record<string, Dict>;
  sub_id?: { format: string } & Dict;
  txn?: string;
};
