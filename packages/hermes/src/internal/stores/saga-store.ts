import type { IProteusRepository } from "@lindorm/proteus";
import type { SagaRecord } from "#internal/entities";

export type SagaIdentifier = {
  id: string;
  name: string;
  namespace: string;
};

export const loadSaga = async (
  repo: IProteusRepository<SagaRecord>,
  identifier: SagaIdentifier,
): Promise<SagaRecord | null> =>
  repo.findOne({
    id: identifier.id,
    name: identifier.name,
    namespace: identifier.namespace,
  });

export const saveSaga = async (
  repo: IProteusRepository<SagaRecord>,
  saga: SagaRecord,
): Promise<SagaRecord> => repo.save(saga);

export const clearMessages = async (
  repo: IProteusRepository<SagaRecord>,
  saga: SagaRecord,
): Promise<SagaRecord> => {
  saga.messagesToDispatch = [];
  return repo.update(saga);
};
