import { ShaKit } from "@lindorm/sha";
import { sortKeys } from "@lindorm/utils";
import { EventStoreAttributes } from "../../types";

export const createChecksum = (
  attributes: Omit<EventStoreAttributes, "checksum">,
): string => {
  const kit = new ShaKit({ algorithm: "SHA256", format: "base64" });

  return kit.hash(JSON.stringify(sortKeys(attributes)));
};
