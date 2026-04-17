import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata";
import { Entity } from "./Entity";
import { Field } from "./Field";
import { JoinTable } from "./JoinTable";
import { ManyToMany } from "./ManyToMany";
import { PrimaryKeyField } from "./PrimaryKeyField";

@Entity({ name: "JoinTableSkill" })
class JoinTableSkill {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  // Inverse side — no @JoinTable
  @ManyToMany(() => JoinTableDeveloper, "skills")
  developers!: JoinTableDeveloper[];
}

@Entity({ name: "JoinTableDeveloper" })
class JoinTableDeveloper {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  // Owning side with default auto-generated table name
  @JoinTable()
  @ManyToMany(() => JoinTableSkill, "developers")
  skills!: JoinTableSkill[];
}

@Entity({ name: "JoinTableTag" })
class JoinTableTag {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  label!: string;

  @ManyToMany(() => JoinTableArticle, "tags")
  articles!: JoinTableArticle[];
}

@Entity({ name: "JoinTableArticle" })
class JoinTableArticle {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  title!: string;

  // Owning side with explicit custom table name
  @JoinTable({ name: "article_tags" })
  @ManyToMany(() => JoinTableTag, "articles")
  tags!: JoinTableTag[];
}

describe("JoinTable", () => {
  test("should use auto-generated alphabetical join table name", () => {
    const meta = getEntityMetadata(JoinTableDeveloper);
    const rel = meta.relations.find((r) => r.key === "skills")!;
    expect(rel.joinTable).toBe("join_table_developer_x_join_table_skill");
  });

  test("should use custom join table name when provided", () => {
    const meta = getEntityMetadata(JoinTableArticle);
    const rel = meta.relations.find((r) => r.key === "tags")!;
    expect(rel.joinTable).toBe("article_tags");
  });

  test("should match snapshot for auto join table", () => {
    expect(getEntityMetadata(JoinTableDeveloper)).toMatchSnapshot();
  });

  test("should match snapshot for custom join table name", () => {
    expect(getEntityMetadata(JoinTableArticle)).toMatchSnapshot();
  });
});
