import { installLazyRelations } from "./install-lazy-relations";
import { isLazyRelation } from "./lazy-relation";
import { isLazyCollection } from "./lazy-collection";
import type { EntityMetadata, MetaRelation } from "../types/metadata";

const makeRelation = (overrides: Partial<MetaRelation>): MetaRelation => ({
  key: "author",
  foreignConstructor: () => class Author {} as any,
  foreignKey: "posts",
  findKeys: { id: "authorId" },
  joinKeys: { authorId: "id" },
  joinTable: null,
  options: {
    deferrable: false,
    initiallyDeferred: false,
    loading: { single: "lazy", multiple: "lazy" },
    nullable: true,
    onDestroy: "ignore",
    onInsert: "ignore",
    onOrphan: "ignore",
    onSoftDestroy: "ignore",
    onUpdate: "ignore",
    strategy: null,
  },
  orderBy: null,
  type: "ManyToOne",
  ...overrides,
});

const makeMetadata = (relations: MetaRelation[]): EntityMetadata =>
  ({ relations }) as EntityMetadata;

const mockLoadRelation = () => jest.fn().mockResolvedValue(null);

describe("installLazyRelations", () => {
  it("should install LazyRelation for ManyToOne with non-null FK", () => {
    const entity: any = { id: "1", authorId: "2" };
    const metadata = makeMetadata([makeRelation({})]);

    installLazyRelations(
      entity,
      metadata,
      { loadRelation: mockLoadRelation() },
      "multiple",
    );

    expect(isLazyRelation(entity.author)).toBe(true);
  });

  it("should set null for ManyToOne with null FK", () => {
    const entity: any = { id: "1", authorId: null };
    const metadata = makeMetadata([makeRelation({})]);

    installLazyRelations(
      entity,
      metadata,
      { loadRelation: mockLoadRelation() },
      "multiple",
    );

    expect(entity.author).toBeNull();
    expect(isLazyRelation(entity.author)).toBe(false);
  });

  it("should install LazyCollection for OneToMany", () => {
    const entity: any = { id: "1" };
    const metadata = makeMetadata([
      makeRelation({
        key: "comments",
        type: "OneToMany",
        joinKeys: null,
        findKeys: { authorId: "id" },
      }),
    ]);

    installLazyRelations(
      entity,
      metadata,
      { loadRelation: mockLoadRelation() },
      "multiple",
    );

    expect(isLazyCollection(entity.comments)).toBe(true);
  });

  it("should install LazyCollection for ManyToMany", () => {
    const entity: any = { id: "1" };
    const metadata = makeMetadata([
      makeRelation({
        key: "tags",
        type: "ManyToMany",
        joinKeys: null,
        findKeys: { postId: "id" },
      }),
    ]);

    installLazyRelations(
      entity,
      metadata,
      { loadRelation: mockLoadRelation() },
      "multiple",
    );

    expect(isLazyCollection(entity.tags)).toBe(true);
  });

  it("should skip non-lazy relations", () => {
    const entity: any = { id: "1", authorId: "2" };
    const metadata = makeMetadata([
      makeRelation({
        options: {
          ...makeRelation({}).options,
          loading: { single: "eager", multiple: "eager" },
        },
      }),
    ]);

    installLazyRelations(
      entity,
      metadata,
      { loadRelation: mockLoadRelation() },
      "multiple",
    );

    expect(entity.author).toBeUndefined();
  });

  it("should skip relations where data is already provided", () => {
    const loaded = { id: "2", name: "Author" };
    const entity: any = { id: "1", authorId: "2", author: loaded };
    const metadata = makeMetadata([makeRelation({})]);

    installLazyRelations(
      entity,
      metadata,
      { loadRelation: mockLoadRelation() },
      "multiple",
    );

    expect(entity.author).toBe(loaded);
    expect(isLazyRelation(entity.author)).toBe(false);
  });

  it("should install LazyRelation for inverse OneToOne (no joinKeys)", () => {
    const entity: any = { id: "1" };
    const metadata = makeMetadata([
      makeRelation({
        key: "profile",
        type: "OneToOne",
        joinKeys: null,
        findKeys: { userId: "id" },
      }),
    ]);

    installLazyRelations(
      entity,
      metadata,
      { loadRelation: mockLoadRelation() },
      "multiple",
    );

    // No joinKeys means we can't check FK null — install thenable
    expect(isLazyRelation(entity.profile)).toBe(true);
  });

  it("should call loadRelation with correct entity and relation on load", async () => {
    const foundAuthor = { id: "2", name: "Author" };
    const loader = jest.fn().mockResolvedValue(foundAuthor);

    const relation = makeRelation({ foreignConstructor: () => class Author {} as any });
    const entity: any = { id: "1", authorId: "2" };
    const metadata = makeMetadata([relation]);

    installLazyRelations(entity, metadata, { loadRelation: loader }, "multiple");

    const result = await entity.author;

    expect(loader).toHaveBeenCalledWith(entity, relation);
    expect(result).toBe(foundAuthor);
    // Self-replacement
    expect(entity.author).toBe(foundAuthor);
  });
});
