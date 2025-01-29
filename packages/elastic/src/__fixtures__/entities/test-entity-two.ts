import { MappingTypeMapping } from "@elastic/elasticsearch/lib/api/types";
import { ElasticEntity } from "../../classes";

export class TestEntityTwo extends ElasticEntity {
  public readonly email!: string;
  public readonly name!: string;
  public readonly _test!: string;
}

export const mappings: MappingTypeMapping = {
  properties: {
    email: {
      type: "text",
    },
    name: {
      type: "text",
    },
    _test: {
      type: "text",
    },
  },
};
