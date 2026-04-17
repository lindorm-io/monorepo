import type { IProteusRepository } from "@lindorm/proteus";
import type { EncryptionRecord } from "../entities";

export const findEncryptionKey = async (
  repo: IProteusRepository<EncryptionRecord>,
  aggregateId: string,
  aggregateName: string,
  aggregateNamespace: string,
): Promise<EncryptionRecord | null> =>
  repo.findOne({ aggregateId, aggregateName, aggregateNamespace });

export const insertEncryptionKey = async (
  repo: IProteusRepository<EncryptionRecord>,
  record: EncryptionRecord,
): Promise<EncryptionRecord> => repo.insert(record);
