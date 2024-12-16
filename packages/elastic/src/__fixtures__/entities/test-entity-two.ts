import { MappingTypeMapping } from "@elastic/elasticsearch/lib/api/types";
import { ElasticEntityBase } from "../../classes";

export class TestEntityTwo extends ElasticEntityBase {
  public readonly email: string;
  public readonly name: string;
  public readonly _test: string;

  public constructor(data: Pick<TestEntityTwo, "email" | "name">) {
    super();

    this.email = data.email ?? "";
    this.name = data.name ?? "";
    this._test = "test";
  }
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
