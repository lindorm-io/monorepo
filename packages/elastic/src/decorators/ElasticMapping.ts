import { MappingTypeMapping } from "@elastic/elasticsearch/lib/api/types";
import { globalEntityMetadata } from "@lindorm/entity";

export type ElasticMappingExtra = {
  mapping: MappingTypeMapping;
};

export function ElasticMapping(mapping: MappingTypeMapping): ClassDecorator {
  return function (target) {
    globalEntityMetadata.addExtra<ElasticMappingExtra>({
      target,
      type: "elastic_mapping",
      mapping,
    });
  };
}
