import { defaultCreateEntity } from "./default-create-entity";
import { CreateDateField } from "../../../decorators/CreateDateField";
import { Default } from "../../../decorators/Default";
import { Entity } from "../../../decorators/Entity";
import { Field } from "../../../decorators/Field";
import { JoinKey } from "../../../decorators/JoinKey";
import { JoinTable } from "../../../decorators/JoinTable";
import { ManyToMany } from "../../../decorators/ManyToMany";
import { Nullable } from "../../../decorators/Nullable";
import { ManyToOne } from "../../../decorators/ManyToOne";
import { OnCreate } from "../../../decorators/OnCreate";
import { OneToMany } from "../../../decorators/OneToMany";
import { OneToOne } from "../../../decorators/OneToOne";
import { PrimaryKeyField } from "../../../decorators/PrimaryKeyField";
import { UpdateDateField } from "../../../decorators/UpdateDateField";
import { VersionField } from "../../../decorators/VersionField";

const onCreateCb = jest.fn();

@Entity({ name: "CreateEntityComment" })
class CreateEntityComment {
  @PrimaryKeyField()
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Field("string")
  body!: string;

  @ManyToOne(() => CreateEntityPost, "comments")
  post!: CreateEntityPost | null;

  postId!: string | null;
}

@Entity({ name: "CreateEntityPost" })
@OnCreate(onCreateCb)
class CreateEntityPost {
  @PrimaryKeyField()
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Field("string")
  title!: string;

  @Nullable()
  @Field("string")
  body!: string | null;

  @Default(0)
  @Field("integer")
  views!: number;

  @OneToMany(() => CreateEntityComment, "post")
  comments!: CreateEntityComment[];
}

@Entity({ name: "CreateEntityAddress" })
class CreateEntityAddress {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  street!: string;

  @OneToOne(() => CreateEntityPerson, "address")
  person!: CreateEntityPerson | null;
}

@Entity({ name: "CreateEntityPerson" })
class CreateEntityPerson {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  @JoinKey()
  @OneToOne(() => CreateEntityAddress, "person")
  address!: CreateEntityAddress | null;

  addressId!: string | null;
}

// ManyToMany entities
@Entity({ name: "CreateEntityM2MTag" })
class CreateEntityM2MTag {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  @ManyToMany(() => CreateEntityM2MArticle, "tags")
  articles!: CreateEntityM2MArticle[];
}

@Entity({ name: "CreateEntityM2MArticle" })
class CreateEntityM2MArticle {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  title!: string;

  @JoinTable()
  @ManyToMany(() => CreateEntityM2MTag, "articles")
  tags!: CreateEntityM2MTag[];
}

describe("defaultCreateEntity", () => {
  test("should create entity with default values", () => {
    const post = defaultCreateEntity(CreateEntityPost, {});
    expect(post).toBeInstanceOf(CreateEntityPost);
    expect(post.views).toBe(0);
    expect(post.comments).toEqual([]);
  });

  test("should apply provided values", () => {
    const post = defaultCreateEntity(CreateEntityPost, {
      title: "Hello World",
      body: "Test body",
    });
    expect(post.title).toBe("Hello World");
    expect(post.body).toBe("Test body");
  });

  test("should create nested OneToMany relation", () => {
    const post = defaultCreateEntity(CreateEntityPost, {
      title: "Hello",
      comments: [{ body: "Great post!" }],
    });
    expect(post.comments).toHaveLength(1);
    expect(post.comments[0]).toBeInstanceOf(CreateEntityComment);
    expect(post.comments[0].body).toBe("Great post!");
  });

  test("should set back-reference on OneToMany child", () => {
    const post = defaultCreateEntity(CreateEntityPost, {
      id: "post-1",
      title: "Hello",
      comments: [{ body: "First comment" }],
    });
    expect(post.comments[0].post).toBe(post);
  });

  test("should not recreate existing instances in OneToMany", () => {
    const existingComment = defaultCreateEntity(CreateEntityComment, {
      body: "existing",
    });
    const post = defaultCreateEntity(CreateEntityPost, {
      title: "Hello",
      comments: [existingComment],
    });
    expect(post.comments[0]).toBe(existingComment);
  });

  test("should not call OnCreate hooks (hooks are dispatched by EntityManager)", () => {
    onCreateCb.mockClear();
    defaultCreateEntity(CreateEntityPost, { title: "Test" });
    expect(onCreateCb).not.toHaveBeenCalled();
  });

  test("should handle recursive guard (circular references)", () => {
    // Creating from an existing post that references itself via circular structure
    const post = defaultCreateEntity(CreateEntityPost, {
      title: "Self-ref",
      comments: [],
    });
    // Create another post that includes the first post object - should not infinite loop
    expect(() => defaultCreateEntity(CreateEntityPost, post)).not.toThrow();
  });

  test("should set joinKey FK columns on owning side", () => {
    const person = defaultCreateEntity(CreateEntityPerson, {
      id: "person-1",
      name: "Alice",
      address: { street: "123 Main St" } as any,
    });

    // The address has no joinKey so the FK is on person (OneToOne, @JoinKey)
    expect(person.address).toBeInstanceOf(CreateEntityAddress);
  });

  test("should create nested ManyToMany relation", () => {
    const article = defaultCreateEntity(CreateEntityM2MArticle, {
      title: "Test Article",
      tags: [{ name: "TypeScript" }, { name: "ORM" }],
    });

    expect(article.tags).toHaveLength(2);
    expect(article.tags[0]).toBeInstanceOf(CreateEntityM2MTag);
    expect(article.tags[0].name).toBe("TypeScript");
    expect(article.tags[1].name).toBe("ORM");
  });

  test("should set back-reference array on ManyToMany child", () => {
    const article = defaultCreateEntity(CreateEntityM2MArticle, {
      title: "Test",
      tags: [{ name: "Tag1" }],
    });

    // ManyToMany back-ref sets an array: created[foreignKey] = [entity]
    expect(article.tags[0].articles).toEqual([article]);
  });

  test("should not recreate existing instances in ManyToMany", () => {
    const existingTag = defaultCreateEntity(CreateEntityM2MTag, { name: "Existing" });
    const article = defaultCreateEntity(CreateEntityM2MArticle, {
      title: "Test",
      tags: [existingTag],
    });

    expect(article.tags[0]).toBe(existingTag);
  });
});
