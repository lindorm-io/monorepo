import { MappingTypeMapping } from "@elastic/elasticsearch/lib/api/types";
import {
  ELASTIC_ENTITY_CONFIG,
  ELASTIC_ENTITY_MAPPING_PROPERTIES,
  ElasticEntity,
} from "../../classes";
import { ValidateElasticEntityFn } from "../../types";

export type TestEntityOneOptions = {
  email?: string;
  name: string;
};

export class TestEntityOne extends ElasticEntity {
  public readonly email!: string | null;
  public readonly name!: string;
}

export const config = ELASTIC_ENTITY_CONFIG;

export const mappings: MappingTypeMapping = {
  properties: {
    ...ELASTIC_ENTITY_MAPPING_PROPERTIES,
    email: { type: "text" },
    name: { type: "text" },
  },
};

export const validate: ValidateElasticEntityFn<TestEntityOne> = (entity) => {
  if (!entity.email) {
    throw new Error("Missing email");
  }

  if (!entity.name) {
    throw new Error("Missing name");
  }
};
