import { ShaKit } from "@lindorm/sha";
import { sortKeys } from "@lindorm/utils";
import { EventStoreAttributes } from "../../types";

export const assertChecksum = (attributes: EventStoreAttributes): void => {
  const { checksum, ...rest } = attributes;

  if (!checksum) {
    throw new Error("Missing checksum");
  }

  const kit = new ShaKit({ algorithm: "SHA256", format: "base64" });

  return kit.assert(JSON.stringify(sortKeys(rest)), checksum);
};
