import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata";
import { Comment } from "./Comment";
import { Entity } from "./Entity";
import { Field } from "./Field";
import { PrimaryKeyField } from "./PrimaryKeyField";

@Entity({ name: "CommentDecorated" })
class CommentDecorated {
  @PrimaryKeyField()
  id!: string;

  @Comment("The user's display name")
  @Field("string")
  name!: string;
}

@Entity({ name: "CommentNoDecorator" })
class CommentNoDecorator {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;
}

describe("Comment", () => {
  test("should stage comment on the field", () => {
    const meta = getEntityMetadata(CommentDecorated);
    const field = meta.fields.find((f) => f.key === "name")!;
    expect(field.comment).toBe("The user's display name");
  });

  test("should default comment to null when not decorated", () => {
    const meta = getEntityMetadata(CommentNoDecorator);
    const field = meta.fields.find((f) => f.key === "name")!;
    expect(field.comment).toBeNull();
  });

  test("should match snapshot", () => {
    expect(getEntityMetadata(CommentDecorated)).toMatchSnapshot();
  });
});
