import { MappingTypeMapping } from "@elastic/elasticsearch/lib/api/types";
import { ElasticEntityBase } from "../../classes";
import { ValidateElasticEntityFn } from "../../types";
import { ElasticEntityConfig } from "../../types/elastic-entity-config";

export type TestEntityOneOptions = {
  email?: string;
  name: string;
};

export class TestEntityOne extends ElasticEntityBase {
  public readonly email!: string | null;
  public readonly name!: string;
}

export const config: ElasticEntityConfig = {
  useSoftDelete: true,
};

export const mappings: MappingTypeMapping = {
  properties: {
    email: {
      type: "text",
    },
    name: {
      type: "text",
    },
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
