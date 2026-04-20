import { describe, expect, test } from "vitest";
import type { EntityMetadata, MetaRelation } from "../../entity/types/metadata";
import type { Constructor } from "@lindorm/types";
import type { IEntity } from "../../../interfaces";
import {
  isOwningRelation,
  isInverseRelation,
  findMirror,
  isSelfReferencing,
  shouldSkipParent,
} from "./relation-filters";

const makeRelation = (overrides: Partial<MetaRelation> = {}): MetaRelation =>
  ({
    key: "tags",
    type: "ManyToOne",
    foreignKey: "tagId",
    findKeys: { tagId: "id" },
    joinKeys: null,
    joinTable: null,
    options: {},
    ...overrides,
  }) as unknown as MetaRelation;

describe("isOwningRelation", () => {
  test("returns true for ManyToOne", () => {
    expect(isOwningRelation(makeRelation({ type: "ManyToOne" }))).toBe(true);
  });

  test("returns true for OneToOne with joinKeys", () => {
    expect(
      isOwningRelation(makeRelation({ type: "OneToOne", joinKeys: { authorId: "id" } })),
    ).toBe(true);
  });

  test("returns false for OneToOne without joinKeys (inverse)", () => {
    expect(isOwningRelation(makeRelation({ type: "OneToOne", joinKeys: null }))).toBe(
      false,
    );
  });

  test("returns false for OneToMany", () => {
    expect(isOwningRelation(makeRelation({ type: "OneToMany" }))).toBe(false);
  });

  test("returns false for ManyToMany", () => {
    expect(isOwningRelation(makeRelation({ type: "ManyToMany" }))).toBe(false);
  });
});

describe("isInverseRelation", () => {
  test("returns false for ManyToOne", () => {
    expect(isInverseRelation(makeRelation({ type: "ManyToOne" }))).toBe(false);
  });

  test("returns true for OneToMany", () => {
    expect(isInverseRelation(makeRelation({ type: "OneToMany" }))).toBe(true);
  });

  test("returns true for ManyToMany", () => {
    expect(isInverseRelation(makeRelation({ type: "ManyToMany" }))).toBe(true);
  });

  test("returns true for inverse OneToOne (no joinKeys)", () => {
    expect(isInverseRelation(makeRelation({ type: "OneToOne", joinKeys: null }))).toBe(
      true,
    );
  });

  test("returns false for owning OneToOne (has joinKeys)", () => {
    expect(
      isInverseRelation(makeRelation({ type: "OneToOne", joinKeys: { fk: "pk" } })),
    ).toBe(false);
  });
});

describe("findMirror", () => {
  test("finds matching relation by foreignKey", () => {
    const relation = makeRelation({ foreignKey: "author" });
    const foreignMetadata = {
      relations: [
        makeRelation({ key: "author", foreignKey: "books" }),
        makeRelation({ key: "editor", foreignKey: "reviews" }),
      ],
    } as unknown as EntityMetadata;

    const mirror = findMirror(relation, foreignMetadata);
    expect(mirror?.key).toBe("author");
  });

  test("returns undefined when no mirror exists", () => {
    const relation = makeRelation({ foreignKey: "nonexistent" });
    const foreignMetadata = {
      relations: [makeRelation({ key: "author" })],
    } as unknown as EntityMetadata;

    expect(findMirror(relation, foreignMetadata)).toBeUndefined();
  });
});

describe("isSelfReferencing", () => {
  test("returns true when keys match symmetrically", () => {
    const relation = makeRelation({ key: "parent", foreignKey: "parent" });
    const mirror = makeRelation({ key: "parent", foreignKey: "parent" });
    expect(isSelfReferencing(relation, mirror)).toBe(true);
  });

  test("returns false when keys differ", () => {
    const relation = makeRelation({ key: "children", foreignKey: "parent" });
    const mirror = makeRelation({ key: "parent", foreignKey: "children" });
    expect(isSelfReferencing(relation, mirror)).toBe(false);
  });
});

describe("shouldSkipParent", () => {
  class ParentEntity {}
  class ChildEntity {}

  test("returns false when no parent is set", () => {
    const relation = makeRelation();
    expect(
      shouldSkipParent(
        relation,
        ChildEntity as Constructor<IEntity>,
        undefined,
        undefined,
      ),
    ).toBe(false);
  });

  test("returns false when foreignTarget does not match parent", () => {
    const relation = makeRelation();
    expect(
      shouldSkipParent(
        relation,
        ChildEntity as Constructor<IEntity>,
        undefined,
        ParentEntity as Constructor<IEntity>,
      ),
    ).toBe(false);
  });

  test("returns true when foreignTarget matches parent and no self-ref", () => {
    const relation = makeRelation({ key: "children", foreignKey: "parent" });
    const mirror = makeRelation({ key: "parent", foreignKey: "children" });
    expect(
      shouldSkipParent(
        relation,
        ParentEntity as Constructor<IEntity>,
        mirror,
        ParentEntity as Constructor<IEntity>,
      ),
    ).toBe(true);
  });

  test("returns true when foreignTarget matches parent and mirror is undefined", () => {
    const relation = makeRelation();
    expect(
      shouldSkipParent(
        relation,
        ParentEntity as Constructor<IEntity>,
        undefined,
        ParentEntity as Constructor<IEntity>,
      ),
    ).toBe(true);
  });

  test("returns false for self-referencing relation", () => {
    const relation = makeRelation({ key: "parent", foreignKey: "parent" });
    const mirror = makeRelation({ key: "parent", foreignKey: "parent" });
    expect(
      shouldSkipParent(
        relation,
        ParentEntity as Constructor<IEntity>,
        mirror,
        ParentEntity as Constructor<IEntity>,
      ),
    ).toBe(false);
  });
});
