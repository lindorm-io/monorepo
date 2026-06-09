import { ShaKit } from "@lindorm/sha";
import { sortKeys } from "@lindorm/utils";
import { ChecksumError } from "../../errors/index.js";
import type { EventRecord } from "../entities/index.js";

export const assertChecksum = (record: EventRecord): void => {
  const { checksum, createdAt, ...rest } = record;

  if (!checksum) {
    throw new ChecksumError("Missing checksum", {
      code: "checksum_missing",
      title: "Checksum Missing",
      details: `Event "${record.id}" has no checksum stored and cannot be verified.`,
      data: { eventId: record.id },
    });
  }

  const kit = new ShaKit({ algorithm: "SHA256", encoding: "base64" });
  kit.assert(JSON.stringify(sortKeys(rest as Record<string, unknown>)), checksum);
};
