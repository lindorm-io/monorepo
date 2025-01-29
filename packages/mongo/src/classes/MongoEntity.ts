import { EntityBase } from "@lindorm/entity";
import { IMongoEntity } from "../interfaces";
import { MongoEntityConfig } from "../types";

export class MongoEntity extends EntityBase implements IMongoEntity {
  public readonly rev!: number;
  public readonly seq!: number;
  public readonly deletedAt!: Date | null;
  public expiresAt!: Date | null;
}

export const MONGO_ENTITY_CONFIG: MongoEntityConfig<MongoEntity> = {
  revisionAttribute: "rev",
  sequenceAttribute: "seq",
  deleteAttribute: "deletedAt",
  ttlAttribute: "expiresAt",
};
