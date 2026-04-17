import { ShaKit } from "@lindorm/sha";
import { sortKeys } from "@lindorm/utils";
import type { EventRecord } from "../entities";

type ChecksumInput = Omit<EventRecord, "checksum" | "createdAt">;

export const createChecksum = (attributes: ChecksumInput): string => {
  const kit = new ShaKit({ algorithm: "SHA256", encoding: "base64" });
  return kit.hash(JSON.stringify(sortKeys(attributes as Record<string, unknown>)));
};
