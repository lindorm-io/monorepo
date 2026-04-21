import { ShaKit } from "@lindorm/sha";
import { sortKeys } from "@lindorm/utils";
import type { EventRecord } from "../entities/index.js";

export const assertChecksum = (record: EventRecord): void => {
  const { checksum, createdAt, ...rest } = record;

  if (!checksum) {
    throw new Error("Missing checksum");
  }

  const kit = new ShaKit({ algorithm: "SHA256", encoding: "base64" });
  kit.assert(JSON.stringify(sortKeys(rest as Record<string, unknown>)), checksum);
};
