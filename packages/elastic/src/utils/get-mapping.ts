import { MappingTypeMapping } from "@elastic/elasticsearch/lib/api/types";
import { EntityMetadata } from "@lindorm/entity";
import { ElasticMappingExtra } from "../decorators";

export const getMapping = (metadata: EntityMetadata): MappingTypeMapping => {
  const extra = (metadata as EntityMetadata<ElasticMappingExtra>).extras.find(
    (e) => e.type === "elastic_mapping",
  );

  if (!extra) return {};

  return extra.mapping;
};
