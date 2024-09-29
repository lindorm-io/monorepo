import { ShaKit } from "@lindorm/sha";
import { sortKeys } from "@lindorm/utils";
import { EventAttributes, EventStoreAttributes } from "../../types";

export const createChecksum = (
  attributes: Omit<EventStoreAttributes, "checksum">,
): string => {
  const kit = new ShaKit({ algorithm: "SHA256", format: "base64" });

  const events = attributes.events.map((event: EventAttributes) => sortKeys(event));
  const sorted = sortKeys({ ...attributes, events });
  const data = JSON.stringify(sorted);

  return kit.hash(data);
};
