import { defaultCloneEntity } from "./default-clone-entity";
import { CreateDateField } from "../../../decorators/CreateDateField";
import { Default } from "../../../decorators/Default";
import { Entity } from "../../../decorators/Entity";
import { Field } from "../../../decorators/Field";
import { Generated } from "../../../decorators/Generated";
import { JoinTable } from "../../../decorators/JoinTable";
import { ManyToMany } from "../../../decorators/ManyToMany";
import { ManyToOne } from "../../../decorators/ManyToOne";
import { OnCreate } from "../../../decorators/OnCreate";
import { OneToMany } from "../../../decorators/OneToMany";
import { PrimaryKey } from "../../../decorators/PrimaryKey";
import { PrimaryKeyField } from "../../../decorators/PrimaryKeyField";
import { UpdateDateField } from "../../../decorators/UpdateDateField";
import { VersionField } from "../../../decorators/VersionField";

const cloneOnCreateCb = jest.fn();

@Entity({ name: "CloneEntityChild" })
class CloneEntityChild {
  @PrimaryKeyField()
  id!: string;

  @VersionField()
  version!: number;

  @Field("string")
  note!: string;

  @ManyToOne(() => CloneEntityParent, "children")
  parent!: CloneEntityParent | null;

  parentId!: string | null;
}

@Entity({ name: "CloneEntityParent" })
@OnCreate(cloneOnCreateCb)
class CloneEntityParent {
  @PrimaryKey()
  @Field("uuid")
  @Generated("uuid")
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Field("string")
  name!: string;

  @Default(0)
  @Field("integer")
  count!: number;

  @OneToMany(() => CloneEntityChild, "parent")
  children!: CloneEntityChild[];
}

// ManyToMany entities
@Entity({ name: "CloneEntityM2MTag" })
class CloneEntityM2MTag {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  @ManyToMany(() => CloneEntityM2MPost, "tags")
  posts!: CloneEntityM2MPost[];
}

@Entity({ name: "CloneEntityM2MPost" })
class CloneEntityM2MPost {
  @PrimaryKey()
  @Field("uuid")
  @Generated("uuid")
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Field("string")
  title!: string;

  @JoinTable()
  @ManyToMany(() => CloneEntityM2MTag, "posts")
  tags!: CloneEntityM2MTag[];
}

describe("defaultCloneEntity", () => {
  test("should skip generated fields (id not assigned in clone)", () => {
    // Generated fields are skipped entirely — the clone will have id=undefined
    // because the field is in metadata.generated and is skipped in the loop
    const original = {
      id: "original-id",
      version: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
      name: "Original",
      count: 5,
      children: [],
    } as CloneEntityParent;

    const clone = defaultCloneEntity(CloneEntityParent, original);
    // Generated field: reset to null so generate() can populate it
    expect(clone.id).toBeNull();
  });

  test("should reset version to null (reset decorator, default=null)", () => {
    // Version is in the reset array → set to undefined, then default=null applied
    const original = {
      id: "abc",
      version: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
      name: "Test",
      count: 1,
      children: [],
    } as CloneEntityParent;

    const clone = defaultCloneEntity(CloneEntityParent, original);
    // reset → undefined; no truthy default → null
    expect(clone.version).toBeNull();
  });

  test("should reset createdAt and updatedAt to null (reset decorator, default=null)", () => {
    const now = new Date();
    const original = {
      id: "abc",
      version: 1,
      createdAt: now,
      updatedAt: now,
      name: "Test",
      count: 0,
      children: [],
    } as CloneEntityParent;

    const clone = defaultCloneEntity(CloneEntityParent, original);
    // CreateDate and UpdateDate are in reset array; default is null
    expect(clone.createdAt).toBeNull();
    expect(clone.updatedAt).toBeNull();
  });

  test("should copy non-reset fields", () => {
    const original = {
      id: "abc",
      version: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
      name: "My Name",
      count: 42,
      children: [],
    } as CloneEntityParent;

    const clone = defaultCloneEntity(CloneEntityParent, original);
    expect(clone.name).toBe("My Name");
    expect(clone.count).toBe(42);
  });

  test("should use default value when cloned field is falsy", () => {
    const original = {
      id: "abc",
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      name: "Test",
      count: 0,
      children: [],
    } as CloneEntityParent;

    const clone = defaultCloneEntity(CloneEntityParent, original);
    // count = 0 (falsy), default = 0 → stays 0
    expect(clone.count).toBe(0);
  });

  test("should clone entity as CloneEntityParent instance", () => {
    const original = {
      id: "abc",
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      name: "Test",
      count: 1,
      children: [],
    } as CloneEntityParent;

    const clone = defaultCloneEntity(CloneEntityParent, original);
    expect(clone).toBeInstanceOf(CloneEntityParent);
  });

  test("should not call OnCreate hooks on clone (hooks are dispatched by EntityManager)", () => {
    cloneOnCreateCb.mockClear();
    const original = {
      id: "abc",
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      name: "Test",
      count: 1,
      children: [],
    } as CloneEntityParent;

    defaultCloneEntity(CloneEntityParent, original);
    expect(cloneOnCreateCb).not.toHaveBeenCalled();
  });

  test("should clone children relations", () => {
    const child = {
      id: "child-1",
      version: 1,
      note: "Hello",
      parent: null,
      parentId: "abc",
    } as CloneEntityChild;

    const original = {
      id: "abc",
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      name: "Test",
      count: 1,
      children: [child],
    } as CloneEntityParent;

    const clone = defaultCloneEntity(CloneEntityParent, original);
    expect(clone.children).toHaveLength(1);
  });

  test("should clone ManyToMany relations", () => {
    const tag = {
      id: "tag-1",
      name: "TypeScript",
      posts: [],
    } as CloneEntityM2MTag;

    const original = {
      id: "post-1",
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      title: "Original Post",
      tags: [tag],
    } as CloneEntityM2MPost;

    const clone = defaultCloneEntity(CloneEntityM2MPost, original);
    expect(clone.tags).toHaveLength(1);
    expect(clone.tags[0]).toBeInstanceOf(CloneEntityM2MTag);
    expect(clone.tags[0].name).toBe("TypeScript");
  });

  test("should set back-reference on cloned ManyToMany child", () => {
    const tag = {
      id: "tag-1",
      name: "ORM",
      posts: [],
    } as CloneEntityM2MTag;

    const original = {
      id: "post-1",
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      title: "Original Post",
      tags: [tag],
    } as CloneEntityM2MPost;

    const clone = defaultCloneEntity(CloneEntityM2MPost, original);
    // ManyToMany back-ref: created[foreignKey] = [clone] (array, not scalar)
    expect(clone.tags[0].posts).toEqual([clone]);
  });

  test("should not recreate existing instances in ManyToMany clone", () => {
    const existingTag = new CloneEntityM2MTag();
    existingTag.id = "existing";
    existingTag.name = "Existing";
    existingTag.posts = [];

    const original = {
      id: "post-1",
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      title: "Test",
      tags: [existingTag],
    } as CloneEntityM2MPost;

    const clone = defaultCloneEntity(CloneEntityM2MPost, original);
    expect(clone.tags[0]).toBe(existingTag);
  });
});
