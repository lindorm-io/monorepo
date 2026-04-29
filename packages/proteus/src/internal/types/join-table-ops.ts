import type { IEntity } from "../../interfaces/index.js";
import type { MetaRelation } from "../entity/types/metadata.js";

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
