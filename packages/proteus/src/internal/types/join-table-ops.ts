import type { IEntity } from "../../interfaces";
import type { MetaRelation } from "#internal/entity/types/metadata";

export type JoinTableOps = {
  sync: (
    entity: IEntity,
    relatedEntities: Array<IEntity>,
    relation: MetaRelation,
    mirror: MetaRelation,
    namespace: string | null,
  ) => Promise<void>;

  delete: (
    entity: IEntity,
    relation: MetaRelation,
    namespace: string | null,
  ) => Promise<void>;
};
