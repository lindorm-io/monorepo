import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
  type Mock,
  type Mocked,
  type MockedFunction,
} from "vitest";
import type { IEntity, IProteusRepository } from "../../../interfaces";
import type {
  EntityMetadata,
  MetaRelation,
  MetaRelationOptions,
} from "../../entity/types/metadata";
import type { JoinTableOps } from "../../types/join-table-ops";
import { RelationPersister } from "./RelationPersister";

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("../../entity/metadata/get-entity-metadata", async () => ({
  getEntityMetadata: vi.fn(),
}));

vi.mock("./build-relation-filter", () => ({
  buildRelationFilter: vi.fn(),
}));

import { getEntityMetadata } from "../../entity/metadata/get-entity-metadata";
import { buildRelationFilter } from "./build-relation-filter";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mockGetEntityMetadata = getEntityMetadata as MockedFunction<
  typeof getEntityMetadata
>;
const mockBuildRelationFilter = buildRelationFilter as MockedFunction<
  typeof buildRelationFilter
>;

const makeMockJoinTableOps = (): Mocked<JoinTableOps> => ({
  sync: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
});

const defaultOptions: MetaRelationOptions = {
  deferrable: false,
  initiallyDeferred: false,
  loading: { single: "eager", multiple: "eager" },
  nullable: true,
  onDestroy: "cascade",
  onInsert: "cascade",
  onOrphan: "ignore",
  onSoftDestroy: "ignore",
  onUpdate: "cascade",
  strategy: null,
};

class ParentEntity {}
class ChildEntity {}
class OtherEntity {}

const makeRelation = (overrides: Partial<MetaRelation> = {}): MetaRelation =>
  ({
    key: "children",
    type: "OneToMany",
    foreignKey: "parent",
    findKeys: { parentId: "id" },
    joinKeys: null,
    joinTable: null,
    foreignConstructor: () => ChildEntity as any,
    options: { ...defaultOptions },
    ...overrides,
  }) as MetaRelation;

const makeMetadata = (
  target: any,
  relations: MetaRelation[] = [],
  primaryKeys: string[] = ["id"],
): EntityMetadata =>
  ({
    target,
    appendOnly: false,
    cache: null,
    checks: [],
    defaultOrder: null,
    embeddedLists: [],
    entity: {
      decorator: "Entity",
      cache: null,
      comment: null,
      database: null,
      name: "Test",
      namespace: null,
    },
    extras: [],
    fields: [],
    filters: [],
    generated: [],
    hooks: [],
    inheritance: null,
    indexes: [],
    primaryKeys,
    relations,
    relationCounts: [],
    relationIds: [],
    schemas: [],
    scopeKeys: [],
    uniques: [],
    versionKeys: [],
  }) as EntityMetadata;

const makeMockRepo = (): Mocked<IProteusRepository<IEntity>> =>
  ({
    save: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
    findOrCreate: vi.fn(),
    count: vi.fn(),
    exists: vi.fn(),
    destroy: vi.fn(),
    delete: vi.fn(),
    restore: vi.fn(),
    query: vi.fn(),
    transaction: vi.fn(),
  }) as any;

const makeLogger = () =>
  ({
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    child: vi.fn(function (this: any) {
      return this;
    }),
  }) as any;

// ─── Local convenience wrapper ──────────────────────────────────────────────

type DestroyContext = {
  metadata: EntityMetadata;
  namespace: string | null;
  parent: any;
  repositoryFactory: Mock;
  joinTableOps: Mocked<JoinTableOps>;
  logger: any;
  soft?: boolean;
};

const destroyRelations = async (entity: any, ctx: DestroyContext) => {
  const { soft, ...rest } = ctx;
  const persister = new RelationPersister(rest);
  return persister.destroy(entity, soft);
};

// ─── destroyRelations (RelationPersister.destroy) ────────────────────────────

describe("RelationPersister.destroy", () => {
  let mockRepo: Mocked<IProteusRepository<IEntity>>;
  let repositoryFactory: Mock;
  let mockJoinTableOps: Mocked<JoinTableOps>;
  let logger: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = makeMockRepo();
    repositoryFactory = vi.fn().mockReturnValue(mockRepo);
    mockJoinTableOps = makeMockJoinTableOps();
    logger = makeLogger();
    mockBuildRelationFilter.mockReturnValue({ parentId: "e1" });
    mockRepo.find.mockResolvedValue([]);
    mockRepo.findOne.mockResolvedValue(null);
    mockRepo.destroy.mockResolvedValue(undefined as any);
  });

  describe("early exit", () => {
    test("returns immediately when metadata has no relations", async () => {
      const metadata = makeMetadata(ParentEntity, []);
      const entity: any = { id: "e1" };

      await destroyRelations(entity, {
        metadata,
        namespace: null,
        parent: undefined,
        repositoryFactory,
        joinTableOps: mockJoinTableOps,
        logger,
      });

      expect(repositoryFactory).not.toHaveBeenCalled();
      expect(mockJoinTableOps.delete).not.toHaveBeenCalled();
    });

    test("skips ManyToOne relations (never cascade to parent)", async () => {
      const relation = makeRelation({
        type: "ManyToOne",
        joinKeys: { parentId: "id" },
        options: { ...defaultOptions, onDestroy: "cascade" },
      });
      const metadata = makeMetadata(ChildEntity, [relation]);
      mockGetEntityMetadata.mockReturnValue(makeMetadata(ParentEntity));
      const entity: any = { id: "e1" };

      await destroyRelations(entity, {
        metadata,
        namespace: null,
        parent: undefined,
        repositoryFactory,
        joinTableOps: mockJoinTableOps,
        logger,
      });

      expect(repositoryFactory).not.toHaveBeenCalled();
    });

    test("cascades owning OneToOne (has joinKeys) — looks up by FK and destroys", async () => {
      const child: any = { id: "profile-99" };
      mockRepo.findOne.mockResolvedValue(child);

      const relation = makeRelation({
        key: "profile",
        type: "OneToOne",
        joinKeys: { profileId: "id" },
        findKeys: null,
        foreignConstructor: () => OtherEntity as any,
        options: { ...defaultOptions, onDestroy: "cascade" },
      });
      const metadata = makeMetadata(ParentEntity, [relation]);
      mockGetEntityMetadata.mockReturnValue(makeMetadata(OtherEntity));
      const entity: any = { id: "u1", profileId: "profile-99" };

      await destroyRelations(entity, {
        metadata,
        namespace: null,
        parent: undefined,
        repositoryFactory,
        joinTableOps: mockJoinTableOps,
        logger,
      });

      expect(repositoryFactory).toHaveBeenCalledWith(OtherEntity, ParentEntity);
      // Filter uses foreignPkCol as key, localFkCol value from entity
      expect(mockRepo.findOne).toHaveBeenCalledWith({ id: "profile-99" });
      expect(mockRepo.destroy).toHaveBeenCalledWith(child);
    });

    test("skips when onDestroy is not cascade", async () => {
      const relation = makeRelation({
        type: "OneToMany",
        options: { ...defaultOptions, onDestroy: "ignore" },
      });
      const metadata = makeMetadata(ParentEntity, [relation]);
      mockGetEntityMetadata.mockReturnValue(makeMetadata(ChildEntity));
      const entity: any = { id: "e1" };

      await destroyRelations(entity, {
        metadata,
        namespace: null,
        parent: undefined,
        repositoryFactory,
        joinTableOps: mockJoinTableOps,
        logger,
      });

      expect(repositoryFactory).not.toHaveBeenCalled();
    });

    test("skips when onDestroy is restrict", async () => {
      const relation = makeRelation({
        type: "OneToMany",
        options: { ...defaultOptions, onDestroy: "restrict" },
      });
      const metadata = makeMetadata(ParentEntity, [relation]);
      mockGetEntityMetadata.mockReturnValue(makeMetadata(ChildEntity));
      const entity: any = { id: "e1" };

      await destroyRelations(entity, {
        metadata,
        namespace: null,
        parent: undefined,
        repositoryFactory,
        joinTableOps: mockJoinTableOps,
        logger,
      });

      expect(repositoryFactory).not.toHaveBeenCalled();
    });
  });

  describe("ManyToMany", () => {
    test("calls deleteJoinTableRows with entity, relation, client, and namespace", async () => {
      const relation = makeRelation({
        key: "courses",
        type: "ManyToMany",
        foreignConstructor: () => OtherEntity as any,
        findKeys: { studentId: "id" },
        joinTable: "student_x_course",
        options: { ...defaultOptions, onDestroy: "cascade" },
      });
      const metadata = makeMetadata(ParentEntity, [relation]);
      mockGetEntityMetadata.mockReturnValue(makeMetadata(OtherEntity));
      const entity: any = { id: "student-1" };

      await destroyRelations(entity, {
        metadata,
        namespace: "myschema",
        parent: undefined,
        repositoryFactory,
        joinTableOps: mockJoinTableOps,
        logger,
      });

      expect(mockJoinTableOps.delete).toHaveBeenCalledWith(entity, relation, "myschema");
      // Should NOT create a repository for ManyToMany
      expect(repositoryFactory).not.toHaveBeenCalled();
    });

    test("passes null namespace through to deleteJoinTableRows", async () => {
      const relation = makeRelation({
        type: "ManyToMany",
        foreignConstructor: () => OtherEntity as any,
        findKeys: { studentId: "id" },
        joinTable: "student_x_course",
        options: { ...defaultOptions, onDestroy: "cascade" },
      });
      const metadata = makeMetadata(ParentEntity, [relation]);
      mockGetEntityMetadata.mockReturnValue(makeMetadata(OtherEntity));
      const entity: any = { id: "s1" };

      await destroyRelations(entity, {
        metadata,
        namespace: null,
        parent: undefined,
        repositoryFactory,
        joinTableOps: mockJoinTableOps,
        logger,
      });

      expect(mockJoinTableOps.delete).toHaveBeenCalledWith(entity, relation, null);
    });
  });

  describe("OneToMany", () => {
    test("finds children using buildRelationFilter and destroys each one", async () => {
      const child1: any = { id: "c1" };
      const child2: any = { id: "c2" };
      mockRepo.find.mockResolvedValue([child1, child2]);

      const relation = makeRelation({
        key: "articles",
        type: "OneToMany",
        foreignConstructor: () => ChildEntity as any,
        findKeys: { authorId: "id" },
        options: { ...defaultOptions, onDestroy: "cascade" },
      });
      const metadata = makeMetadata(ParentEntity, [relation]);
      mockGetEntityMetadata.mockReturnValue(makeMetadata(ChildEntity));
      const entity: any = { id: "author-1" };

      await destroyRelations(entity, {
        metadata,
        namespace: null,
        parent: undefined,
        repositoryFactory,
        joinTableOps: mockJoinTableOps,
        logger,
      });

      expect(repositoryFactory).toHaveBeenCalledWith(ChildEntity, ParentEntity);
      expect(mockBuildRelationFilter).toHaveBeenCalledWith(relation, entity);
      expect(mockRepo.find).toHaveBeenCalledWith({ parentId: "e1" });
      expect(mockRepo.destroy).toHaveBeenCalledTimes(2);
      expect(mockRepo.destroy).toHaveBeenCalledWith(child1);
      expect(mockRepo.destroy).toHaveBeenCalledWith(child2);
    });

    test("does nothing when find returns empty array", async () => {
      mockRepo.find.mockResolvedValue([]);

      const relation = makeRelation({
        type: "OneToMany",
        foreignConstructor: () => ChildEntity as any,
        findKeys: { parentId: "id" },
        options: { ...defaultOptions, onDestroy: "cascade" },
      });
      const metadata = makeMetadata(ParentEntity, [relation]);
      mockGetEntityMetadata.mockReturnValue(makeMetadata(ChildEntity));
      const entity: any = { id: "e1" };

      await destroyRelations(entity, {
        metadata,
        namespace: null,
        parent: undefined,
        repositoryFactory,
        joinTableOps: mockJoinTableOps,
        logger,
      });

      expect(mockRepo.find).toHaveBeenCalled();
      expect(mockRepo.destroy).not.toHaveBeenCalled();
    });

    test("destroys multiple children in iteration order", async () => {
      const destroyOrder: string[] = [];
      const children = [{ id: "a" }, { id: "b" }, { id: "c" }] as any[];
      mockRepo.find.mockResolvedValue(children);
      mockRepo.destroy.mockImplementation(async (c: any) => {
        destroyOrder.push(c.id);
        return undefined as any;
      });

      const relation = makeRelation({
        type: "OneToMany",
        foreignConstructor: () => ChildEntity as any,
        options: { ...defaultOptions, onDestroy: "cascade" },
      });
      const metadata = makeMetadata(ParentEntity, [relation]);
      mockGetEntityMetadata.mockReturnValue(makeMetadata(ChildEntity));
      const entity: any = { id: "e1" };

      await destroyRelations(entity, {
        metadata,
        namespace: null,
        parent: undefined,
        repositoryFactory,
        joinTableOps: mockJoinTableOps,
        logger,
      });

      expect(destroyOrder).toEqual(["a", "b", "c"]);
    });
  });

  describe("OneToOne inverse", () => {
    test("finds child using buildRelationFilter and destroys it when found", async () => {
      const child: any = { id: "profile-1" };
      mockRepo.findOne.mockResolvedValue(child);

      const relation = makeRelation({
        key: "profile",
        type: "OneToOne",
        foreignConstructor: () => OtherEntity as any,
        joinKeys: null, // inverse side
        findKeys: { userId: "id" },
        options: { ...defaultOptions, onDestroy: "cascade" },
      });
      const metadata = makeMetadata(ParentEntity, [relation]);
      mockGetEntityMetadata.mockReturnValue(makeMetadata(OtherEntity));
      const entity: any = { id: "user-1" };

      await destroyRelations(entity, {
        metadata,
        namespace: null,
        parent: undefined,
        repositoryFactory,
        joinTableOps: mockJoinTableOps,
        logger,
      });

      expect(repositoryFactory).toHaveBeenCalledWith(OtherEntity, ParentEntity);
      expect(mockBuildRelationFilter).toHaveBeenCalledWith(relation, entity);
      expect(mockRepo.findOne).toHaveBeenCalledWith({ parentId: "e1" });
      expect(mockRepo.destroy).toHaveBeenCalledWith(child);
    });

    test("does nothing when findOne returns null", async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const relation = makeRelation({
        key: "profile",
        type: "OneToOne",
        foreignConstructor: () => OtherEntity as any,
        joinKeys: null,
        findKeys: { userId: "id" },
        options: { ...defaultOptions, onDestroy: "cascade" },
      });
      const metadata = makeMetadata(ParentEntity, [relation]);
      mockGetEntityMetadata.mockReturnValue(makeMetadata(OtherEntity));
      const entity: any = { id: "user-1" };

      await destroyRelations(entity, {
        metadata,
        namespace: null,
        parent: undefined,
        repositoryFactory,
        joinTableOps: mockJoinTableOps,
        logger,
      });

      expect(mockRepo.findOne).toHaveBeenCalled();
      expect(mockRepo.destroy).not.toHaveBeenCalled();
    });
  });

  describe("multiple relations", () => {
    test("processes all eligible relations in sequence", async () => {
      const childA: any = { id: "a" };
      const childB: any = { id: "b" };

      // ManyToMany does NOT call repositoryFactory — only OneToMany does.
      // Configure a single repo for the OneToMany branch.
      const oneToManyRepo = makeMockRepo();
      oneToManyRepo.find.mockResolvedValue([childA, childB]);
      oneToManyRepo.destroy.mockResolvedValue(undefined as any);

      repositoryFactory.mockReturnValue(oneToManyRepo);

      const m2mRelation = makeRelation({
        key: "tags",
        type: "ManyToMany",
        foreignConstructor: () => OtherEntity as any,
        findKeys: { entityId: "id" },
        joinTable: "entity_x_tag",
        options: { ...defaultOptions, onDestroy: "cascade" },
      });

      const oneToManyRelation = makeRelation({
        key: "items",
        type: "OneToMany",
        foreignConstructor: () => ChildEntity as any,
        findKeys: { entityId: "id" },
        options: { ...defaultOptions, onDestroy: "cascade" },
      });

      const metadata = makeMetadata(ParentEntity, [m2mRelation, oneToManyRelation]);
      mockGetEntityMetadata
        .mockReturnValueOnce(makeMetadata(OtherEntity))
        .mockReturnValueOnce(makeMetadata(ChildEntity));
      const entity: any = { id: "e1" };

      await destroyRelations(entity, {
        metadata,
        namespace: null,
        parent: undefined,
        repositoryFactory,
        joinTableOps: mockJoinTableOps,
        logger,
      });

      expect(mockJoinTableOps.delete).toHaveBeenCalledWith(entity, m2mRelation, null);
      expect(oneToManyRepo.destroy).toHaveBeenCalledWith(childA);
      expect(oneToManyRepo.destroy).toHaveBeenCalledWith(childB);
    });

    test("skips ignored relations but processes cascade relations", async () => {
      const ignoredRelation = makeRelation({
        key: "tags",
        type: "OneToMany",
        foreignConstructor: () => OtherEntity as any,
        options: { ...defaultOptions, onDestroy: "ignore" },
      });

      const cascadeRelation = makeRelation({
        key: "items",
        type: "OneToMany",
        foreignConstructor: () => ChildEntity as any,
        options: { ...defaultOptions, onDestroy: "cascade" },
      });

      const metadata = makeMetadata(ParentEntity, [ignoredRelation, cascadeRelation]);
      mockGetEntityMetadata
        .mockReturnValueOnce(makeMetadata(OtherEntity))
        .mockReturnValueOnce(makeMetadata(ChildEntity));
      mockRepo.find.mockResolvedValue([]);
      const entity: any = { id: "e1" };

      await destroyRelations(entity, {
        metadata,
        namespace: null,
        parent: undefined,
        repositoryFactory,
        joinTableOps: mockJoinTableOps,
        logger,
      });

      // Only one repositoryFactory call for the cascade relation
      expect(repositoryFactory).toHaveBeenCalledTimes(1);
      expect(repositoryFactory).toHaveBeenCalledWith(ChildEntity, ParentEntity);
    });
  });

  describe("parent guard", () => {
    test("skips relation when foreignTarget equals parent (circular guard)", async () => {
      // OneToMany where children happen to be the same type as the caller (ParentEntity)
      const relation = makeRelation({
        key: "children",
        type: "OneToMany",
        foreignKey: "someDifferentKey",
        foreignConstructor: () => ParentEntity as any,
        findKeys: { parentId: "id" },
        options: { ...defaultOptions, onDestroy: "cascade" },
      });

      // mirror relation has different keys → not self-referencing
      const mirrorRelation = makeRelation({
        key: "differentMirrorKey",
        type: "ManyToOne",
        foreignKey: "differentForeignKey",
        foreignConstructor: () => ChildEntity as any,
        joinKeys: { parentId: "id" },
      });

      const metadata = makeMetadata(ChildEntity, [relation]);
      mockGetEntityMetadata.mockReturnValue(makeMetadata(ParentEntity, [mirrorRelation]));
      const entity: any = { id: "e1" };

      await destroyRelations(entity, {
        metadata,
        namespace: null,
        parent: ParentEntity as any,
        repositoryFactory,
        joinTableOps: mockJoinTableOps,
        logger,
      });

      expect(repositoryFactory).not.toHaveBeenCalled();
    });

    test("does NOT skip when parent is set but foreignTarget is a different class", async () => {
      const child: any = { id: "c1" };
      mockRepo.find.mockResolvedValue([child]);
      mockRepo.destroy.mockResolvedValue(undefined as any);

      const relation = makeRelation({
        key: "items",
        type: "OneToMany",
        foreignConstructor: () => ChildEntity as any, // different from ParentEntity
        findKeys: { ownerId: "id" },
        options: { ...defaultOptions, onDestroy: "cascade" },
      });

      const metadata = makeMetadata(OtherEntity, [relation]);
      mockGetEntityMetadata.mockReturnValue(makeMetadata(ChildEntity));
      const entity: any = { id: "e1" };

      await destroyRelations(entity, {
        metadata,
        namespace: null,
        parent: ParentEntity as any, // different from ChildEntity
        repositoryFactory,
        joinTableOps: mockJoinTableOps,
        logger,
      });

      expect(repositoryFactory).toHaveBeenCalledWith(ChildEntity, OtherEntity);
      expect(mockRepo.destroy).toHaveBeenCalledWith(child);
    });
  });

  describe("soft destroy", () => {
    test("uses onSoftDestroy instead of onDestroy when soft: true", async () => {
      const relation = makeRelation({
        key: "items",
        type: "OneToMany",
        options: { ...defaultOptions, onDestroy: "ignore", onSoftDestroy: "cascade" },
      });

      const metadata = makeMetadata(ParentEntity, [relation]);
      mockGetEntityMetadata.mockReturnValue(makeMetadata(ChildEntity));
      mockRepo.find.mockResolvedValue([{ id: "c1" }]);

      const entity: any = { id: "e1" };
      await destroyRelations(entity, {
        metadata,
        namespace: null,
        parent: undefined,
        repositoryFactory,
        joinTableOps: mockJoinTableOps,
        logger,
        soft: true,
      });

      // Should cascade because onSoftDestroy is "cascade"
      expect(repositoryFactory).toHaveBeenCalledWith(ChildEntity, ParentEntity);
      expect(mockRepo.destroy).toHaveBeenCalledWith({ id: "c1" });
    });

    test("skips when onSoftDestroy is ignore even if onDestroy is cascade", async () => {
      const relation = makeRelation({
        key: "items",
        type: "OneToMany",
        options: { ...defaultOptions, onDestroy: "cascade", onSoftDestroy: "ignore" },
      });

      const metadata = makeMetadata(ParentEntity, [relation]);
      mockGetEntityMetadata.mockReturnValue(makeMetadata(ChildEntity));

      const entity: any = { id: "e1" };
      await destroyRelations(entity, {
        metadata,
        namespace: null,
        parent: undefined,
        repositoryFactory,
        joinTableOps: mockJoinTableOps,
        logger,
        soft: true,
      });

      // Should NOT cascade because onSoftDestroy is "ignore"
      expect(repositoryFactory).not.toHaveBeenCalled();
    });

    test("uses onDestroy when soft flag is absent", async () => {
      const relation = makeRelation({
        key: "items",
        type: "OneToMany",
        options: { ...defaultOptions, onDestroy: "cascade", onSoftDestroy: "ignore" },
      });

      const metadata = makeMetadata(ParentEntity, [relation]);
      mockGetEntityMetadata.mockReturnValue(makeMetadata(ChildEntity));
      mockRepo.find.mockResolvedValue([{ id: "c1" }]);

      const entity: any = { id: "e1" };
      await destroyRelations(entity, {
        metadata,
        namespace: null,
        parent: undefined,
        repositoryFactory,
        joinTableOps: mockJoinTableOps,
        logger,
      });

      // Should cascade because onDestroy is "cascade" and soft is not set
      expect(repositoryFactory).toHaveBeenCalledWith(ChildEntity, ParentEntity);
      expect(mockRepo.destroy).toHaveBeenCalledWith({ id: "c1" });
    });
  });
});
