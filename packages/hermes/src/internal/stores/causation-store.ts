import type { IProteusRepository } from "@lindorm/proteus";
import type { CausationRecord } from "../entities";

export const causationExists = async (
  repo: IProteusRepository<CausationRecord>,
  ownerId: string,
  ownerName: string,
  causationId: string,
): Promise<boolean> => repo.exists({ ownerId, ownerName, causationId });

export const insertCausation = async (
  repo: IProteusRepository<CausationRecord>,
  record: CausationRecord,
): Promise<CausationRecord> => repo.insert(record);

export const findCausations = async (
  repo: IProteusRepository<CausationRecord>,
  ownerId: string,
  ownerName: string,
): Promise<Array<CausationRecord>> => repo.find({ ownerId, ownerName });
