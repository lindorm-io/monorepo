import { MappingTypeMapping } from "@elastic/elasticsearch/lib/api/types";
import { EntityBase } from "@lindorm/entity";
import { IElasticEntity } from "../interfaces";
import { ElasticEntityConfig } from "../types";

export class ElasticEntity extends EntityBase implements IElasticEntity {
  public readonly primaryTerm!: number;
  public readonly rev!: number;
  public readonly seq!: number;
  public readonly deletedAt!: Date | null;
  public expiresAt!: Date | null;
}

export const ELASTIC_ENTITY_CONFIG: ElasticEntityConfig<ElasticEntity> = {
  primaryTermAttribute: "primaryTerm",
  revisionAttribute: "rev",
  sequenceAttribute: "seq",
  deleteAttribute: "deletedAt",
  ttlAttribute: "expiresAt",
};

export const ELASTIC_ENTITY_MAPPING_PROPERTIES: MappingTypeMapping["properties"] = {
  deletedAt: { type: "date" },
  expiresAt: { type: "date" },
};
