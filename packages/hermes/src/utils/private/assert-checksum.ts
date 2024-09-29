import { ShaKit } from "@lindorm/sha";
import { sortKeys } from "@lindorm/utils";
import { EventAttributes, EventStoreAttributes } from "../../types";

export const assertChecksum = (attributes: EventStoreAttributes): void => {
  const kit = new ShaKit({ algorithm: "SHA256", format: "base64" });
  const { checksum, ...rest } = attributes;

  if (!checksum) {
    throw new Error("Missing checksum");
  }

  const events = rest.events.map((event: EventAttributes) => sortKeys(event));
  const sorted = sortKeys({ ...rest, events });
  const data = JSON.stringify(sorted);

  kit.assert(data, checksum);
};
