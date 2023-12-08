import { sortObjectKeys } from "@lindorm-io/core";
import { createShaHash } from "@lindorm-io/crypto";
import { EventAttributes, EventStoreAttributes } from "../types";

export const createChecksum = (attributes: Omit<EventStoreAttributes, "checksum">): string => {
  const events = attributes.events.map((event: EventAttributes) => sortObjectKeys(event));
  const sorted = sortObjectKeys({ ...attributes, events });
  const data = JSON.stringify(sorted);

  return createShaHash({ algorithm: "SHA256", data, format: "base64" });
};
