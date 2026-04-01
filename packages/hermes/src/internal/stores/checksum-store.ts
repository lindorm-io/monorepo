import type { IProteusRepository } from "@lindorm/proteus";
import type { ChecksumRecord } from "#internal/entities";

export const findChecksum = async (
  repo: IProteusRepository<ChecksumRecord>,
  eventId: string,
): Promise<ChecksumRecord | null> => repo.findOne({ eventId });

export const insertChecksum = async (
  repo: IProteusRepository<ChecksumRecord>,
  record: ChecksumRecord,
): Promise<ChecksumRecord> => repo.insert(record);
