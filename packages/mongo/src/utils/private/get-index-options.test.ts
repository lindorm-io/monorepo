import { Entity, EntityBase, globalEntityMetadata } from "@lindorm/entity";
import { MongoFileBase } from "../../classes";
import { File } from "../../decorators";
import { getIndexOptions } from "./get-index-options";

describe("getIndexOptions", () => {
  test("should return options for EntityBase", () => {
    @Entity()
    class TestEntityBase extends EntityBase {}

    const metadata = globalEntityMetadata.get(TestEntityBase);

    expect(getIndexOptions(metadata)).toMatchSnapshot();
  });

  test("should return options for MongoFileBase", () => {
    @File()
    class TestMongoFileBase extends MongoFileBase {}

    const metadata = globalEntityMetadata.get(TestMongoFileBase);

    expect(getIndexOptions(metadata)).toMatchSnapshot();
  });
});
