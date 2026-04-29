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
import type { IEntity, IProteusRepository } from "../../../interfaces/index.js";
import type {
  EntityMetadata,
  MetaRelation,
  MetaRelationOptions,
} from "../../entity/types/metadata.js";
import type { JoinTableOps } from "../../types/join-table-ops.js";
import { RelationPersister } from "./RelationPersister.js";

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("../../entity/metadata/get-entity-metadata.js", async () => ({
  getEntityMetadata: vi.fn(),
}));

vi.mock("./build-relation-filter.js", () => ({
  buildRelationFilter: vi.fn(),
}));

import { getEntityMetadata } from "../../entity/metadata/get-entity-metadata.js";
import { buildRelationFilter } from "./build-relation-filter.js";

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
  onDestroy: "ignore",
  onInsert: "cascade",
  onOrphan: "ignore",
  onSoftDestroy: "ignore",
  onUpdate: "cascade",
  strategy: null,
};

class ParentEntity {}
class ChildEntity {}
class OtherEntity {}
class GrandchildEntity {}

const makeRelation = (overrides: Partial<MetaRelation> = {}): MetaRelation =>
  ({
    key: "child",
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

// ─── Local convenience wrappers ──────────────────────────────────────────────

type RelationContext = {
  metadata: EntityMetadata;
  namespace: string | null;
  parent: any;
  repositoryFactory: Mock;
  joinTableOps: Mocked<JoinTableOps>;
  logger: any;
};

const saveOwningRelations = async (
  entity: any,
  mode: "insert" | "update",
  ctx: RelationContext,
) => {
  const persister = new RelationPersister(ctx);
  return persister.saveOwning(entity, mode);
};

const saveInverseRelations = async (
  entity: any,
  mode: "insert" | "update",
  ctx: RelationContext,
) => {
  const persister = new RelationPersister(ctx);
  return persister.saveInverse(entity, mode);
};

// ─── saveOwningRelations (RelationPersister.saveOwning) ──────────────────────

describe("RelationPersister.saveOwning", () => {
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
  });

  describe("early exit", () => {
    test("returns immediately when metadata has no relations", async () => {
      const metadata = makeMetadata(ParentEntity, []);
      const entity: any = { id: "e1" };

      await saveOwningRelations(entity, "insert", {
        metadata,
        namespace: null,
        parent: undefined,
        repositoryFactory,
        joinTableOps: mockJoinTableOps,
        logger,
      });

      expect(repositoryFactory).not.toHaveBeenCalled();
    });

    test("skips OneToMany relations (not owning)", async () => {
      const relation = makeRelation({ type: "OneToMany", joinKeys: null });
      const metadata = makeMetadata(ParentEntity, [relation]);
      mockGetEntityMetadata.mockReturnValue(makeMetadata(ChildEntity));
      const entity: any = { id: "e1", child: [{ id: "c1" }] };

      await saveOwningRelations(entity, "insert", {
        metadata,
        namespace: null,
        parent: undefined,
        repositoryFactory,
        joinTableOps: mockJoinTableOps,
        logger,
      });

      expect(repositoryFactory).not.toHaveBeenCalled();
    });

    test("skips inverse OneToOne (no joinKeys)", async () => {
      const relation = makeRelation({ type: "OneToOne", joinKeys: null });
      const metadata = makeMetadata(ParentEntity, [relation]);
      mockGetEntityMetadata.mockReturnValue(makeMetadata(ChildEntity));
      const entity: any = { id: "e1", child: { id: "c1" } };

      await saveOwningRelations(entity, "insert", {
        metadata,
        namespace: null,
        parent: undefined,
        repositoryFactory,
        joinTableOps: mockJoinTableOps,
        logger,
      });

      expect(repositoryFactory).not.toHaveBeenCalled();
    });

    test("skips when onInsert is not cascade (insert mode)", async () => {
      const relation = makeRelation({
        type: "ManyToOne",
        joinKeys: { authorId: "id" },
        options: { ...defaultOptions, onInsert: "ignore" },
      });
      const metadata = makeMetadata(ChildEntity, [relation]);
      mockGetEntityMetadata.mockReturnValue(makeMetadata(ParentEntity));
      const entity: any = { id: "e1", child: { id: "p1" } };

      await saveOwningRelations(entity, "insert", {
        metadata,
        namespace: null,
        parent: undefined,
        repositoryFactory,
        joinTableOps: mockJoinTableOps,
        logger,
      });

      expect(repositoryFactory).not.toHaveBeenCalled();
    });

    test("skips when onUpdate is not cascade (update mode)", async () => {
      const relation = makeRelation({
        type: "ManyToOne",
        joinKeys: { authorId: "id" },
        options: { ...defaultOptions, onUpdate: "ignore" },
      });
      const metadata = makeMetadata(ChildEntity, [relation]);
      mockGetEntityMetadata.mockReturnValue(makeMetadata(ParentEntity));
      const entity: any = { id: "e1", child: { id: "p1" } };

      await saveOwningRelations(entity, "update", {
        metadata,
        namespace: null,
        parent: undefined,
        repositoryFactory,
        joinTableOps: mockJoinTableOps,
        logger,
      });

      expect(repositoryFactory).not.toHaveBeenCalled();
    });

    test("skips when related entity is null", async () => {
      const relation = makeRelation({
        type: "ManyToOne",
        joinKeys: { authorId: "id" },
      });
      const metadata = makeMetadata(ChildEntity, [relation]);
      mockGetEntityMetadata.mockReturnValue(makeMetadata(ParentEntity));
      const entity: any = { id: "e1", child: null };

      await saveOwningRelations(entity, "insert", {
        metadata,
        namespace: null,
        parent: undefined,
        repositoryFactory,
        joinTableOps: mockJoinTableOps,
        logger,
      });

      expect(repositoryFactory).not.toHaveBeenCalled();
    });

    test("skips when related entity is undefined", async () => {
      const relation = makeRelation({
        type: "ManyToOne",
        joinKeys: { authorId: "id" },
      });
      const metadata = makeMetadata(ChildEntity, [relation]);
      mockGetEntityMetadata.mockReturnValue(makeMetadata(ParentEntity));
      const entity: any = { id: "e1" }; // child key absent

      await saveOwningRelations(entity, "insert", {
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

  describe("ManyToOne cascade", () => {
    test("saves the parent and writes FK back to entity on insert", async () => {
      const parent = { id: "parent-uuid-1" } as any;
      const savedParent = { id: "parent-uuid-saved" } as any;
      mockRepo.save.mockResolvedValue(savedParent);

      const relation = makeRelation({
        key: "author",
        type: "ManyToOne",
        foreignKey: "articles",
        foreignConstructor: () => ParentEntity as any,
        joinKeys: { authorId: "id" },
        options: { ...defaultOptions, onInsert: "cascade" },
      });
      const metadata = makeMetadata(ChildEntity, [relation]);
      mockGetEntityMetadata.mockReturnValue(makeMetadata(ParentEntity));
      const entity: any = { id: "e1", author: parent };

      await saveOwningRelations(entity, "insert", {
        metadata,
        namespace: null,
        parent: undefined,
        repositoryFactory,
        joinTableOps: mockJoinTableOps,
        logger,
      });

      expect(repositoryFactory).toHaveBeenCalledWith(ParentEntity, ChildEntity);
      expect(mockRepo.save).toHaveBeenCalledWith(parent);
      // FK written back
      expect(entity.authorId).toBe("parent-uuid-saved");
    });

    test("saves the parent on update mode when onUpdate is cascade", async () => {
      const parent = { id: "parent-1" } as any;
      const savedParent = { id: "parent-1-updated" } as any;
      mockRepo.save.mockResolvedValue(savedParent);

      const relation = makeRelation({
        key: "author",
        type: "ManyToOne",
        foreignConstructor: () => ParentEntity as any,
        joinKeys: { authorId: "id" },
        options: { ...defaultOptions, onUpdate: "cascade", onInsert: "ignore" },
      });
      const metadata = makeMetadata(ChildEntity, [relation]);
      mockGetEntityMetadata.mockReturnValue(makeMetadata(ParentEntity));
      const entity: any = { id: "e1", author: parent };

      await saveOwningRelations(entity, "update", {
        metadata,
        namespace: null,
        parent: undefined,
        repositoryFactory,
        joinTableOps: mockJoinTableOps,
        logger,
      });

      expect(mockRepo.save).toHaveBeenCalledWith(parent);
      expect(entity.authorId).toBe("parent-1-updated");
    });

    test("FK write-back uses joinKeys mapping to copy multiple FK columns", async () => {
      const parent = { tenantId: "t1", id: "p1" } as any;
      mockRepo.save.mockResolvedValue(parent);

      const relation = makeRelation({
        key: "owner",
        type: "ManyToOne",
        foreignConstructor: () => ParentEntity as any,
        joinKeys: { ownerTenantId: "tenantId", ownerId: "id" },
        options: { ...defaultOptions },
      });
      const metadata = makeMetadata(ChildEntity, [relation]);
      mockGetEntityMetadata.mockReturnValue(makeMetadata(ParentEntity));
      const entity: any = { id: "e1", owner: parent };

      await saveOwningRelations(entity, "insert", {
        metadata,
        namespace: null,
        parent: undefined,
        repositoryFactory,
        joinTableOps: mockJoinTableOps,
        logger,
      });

      expect(entity.ownerTenantId).toBe("t1");
      expect(entity.ownerId).toBe("p1");
    });
  });

  describe("owning OneToOne cascade", () => {
    test("saves the related entity and writes FK back", async () => {
      const profile = { id: "profile-1" } as any;
      const savedProfile = { id: "profile-saved" } as any;
      mockRepo.save.mockResolvedValue(savedProfile);

      const relation = makeRelation({
        key: "profile",
        type: "OneToOne",
        foreignConstructor: () => OtherEntity as any,
        joinKeys: { profileId: "id" },
        findKeys: null,
        options: { ...defaultOptions },
      });
      const metadata = makeMetadata(ParentEntity, [relation]);
      mockGetEntityMetadata.mockReturnValue(makeMetadata(OtherEntity));
      const entity: any = { id: "user-1", profile };

      await saveOwningRelations(entity, "insert", {
        metadata,
        namespace: null,
        parent: undefined,
        repositoryFactory,
        joinTableOps: mockJoinTableOps,
        logger,
      });

      expect(repositoryFactory).toHaveBeenCalledWith(OtherEntity, ParentEntity);
      expect(mockRepo.save).toHaveBeenCalledWith(profile);
      expect(entity.profileId).toBe("profile-saved");
    });
  });

  describe("parent guard", () => {
    test("skips relation when foreignTarget equals parent (circular guard)", async () => {
      // ChildEntity has a ManyToOne back to ParentEntity
      // but we are already being called from ParentEntity context
      const relation = makeRelation({
        key: "author",
        type: "ManyToOne",
        foreignConstructor: () => ParentEntity as any,
        joinKeys: { authorId: "id" },
        foreignKey: "articles",
        options: { ...defaultOptions },
      });
      // mirror relation key does NOT match self-referencing pattern
      const mirrorRelation = makeRelation({
        key: "articles",
        type: "OneToMany",
        foreignKey: "author", // different key → not self-referencing
        foreignConstructor: () => ChildEntity as any,
        joinKeys: null,
      });
      const metadata = makeMetadata(ChildEntity, [relation]);
      // foreignMetadata for ParentEntity returns mirror that is NOT self-referencing
      mockGetEntityMetadata.mockReturnValue(makeMetadata(ParentEntity, [mirrorRelation]));
      const entity: any = { id: "e1", author: { id: "p1" } };

      await saveOwningRelations(entity, "insert", {
        metadata,
        namespace: null,
        parent: ParentEntity as any, // <-- circular guard active
        repositoryFactory,
        joinTableOps: mockJoinTableOps,
        logger,
      });

      expect(repositoryFactory).not.toHaveBeenCalled();
    });

    test("does NOT skip when parent is set but foreignTarget is different", async () => {
      const parent = { id: "other-1" } as any;
      const savedParent = { id: "other-saved" } as any;
      mockRepo.save.mockResolvedValue(savedParent);

      const relation = makeRelation({
        key: "category",
        type: "ManyToOne",
        foreignConstructor: () => OtherEntity as any,
        joinKeys: { categoryId: "id" },
        options: { ...defaultOptions },
      });
      const metadata = makeMetadata(ChildEntity, [relation]);
      mockGetEntityMetadata.mockReturnValue(makeMetadata(OtherEntity));
      const entity: any = { id: "e1", category: parent };

      await saveOwningRelations(entity, "insert", {
        metadata,
        namespace: null,
        parent: ParentEntity as any, // different from OtherEntity
        repositoryFactory,
        joinTableOps: mockJoinTableOps,
        logger,
      });

      expect(mockRepo.save).toHaveBeenCalledWith(parent);
    });
  });
});

// ─── saveInverseRelations (RelationPersister.saveInverse) ────────────────────

describe("RelationPersister.saveInverse", () => {
  let mockChildRepo: Mocked<IProteusRepository<IEntity>>;
  let repositoryFactory: Mock;
  let mockJoinTableOps: Mocked<JoinTableOps>;
  let logger: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockChildRepo = makeMockRepo();
    repositoryFactory = vi.fn().mockReturnValue(mockChildRepo);
    mockJoinTableOps = makeMockJoinTableOps();
    logger = makeLogger();
    mockBuildRelationFilter.mockReturnValue({ parentId: "e1" });
  });

  describe("early exit", () => {
    test("returns immediately when metadata has no relations", async () => {
      const metadata = makeMetadata(ParentEntity, []);
      const entity: any = { id: "e1" };

      await saveInverseRelations(entity, "insert", {
        metadata,
        namespace: null,
        parent: undefined,
        repositoryFactory,
        joinTableOps: mockJoinTableOps,
        logger,
      });

      expect(repositoryFactory).not.toHaveBeenCalled();
    });

    test("skips ManyToOne relations (owning side, handled elsewhere)", async () => {
      const relation = makeRelation({
        type: "ManyToOne",
        joinKeys: { authorId: "id" },
      });
      const metadata = makeMetadata(ChildEntity, [relation]);
      mockGetEntityMetadata.mockReturnValue(makeMetadata(ParentEntity));
      const entity: any = { id: "e1" };

      await saveInverseRelations(entity, "insert", {
        metadata,
        namespace: null,
        parent: undefined,
        repositoryFactory,
        joinTableOps: mockJoinTableOps,
        logger,
      });

      expect(repositoryFactory).not.toHaveBeenCalled();
    });

    test("skips owning OneToOne (has joinKeys, handled elsewhere)", async () => {
      const relation = makeRelation({
        type: "OneToOne",
        joinKeys: { profileId: "id" },
      });
      const metadata = makeMetadata(ParentEntity, [relation]);
      mockGetEntityMetadata.mockReturnValue(makeMetadata(OtherEntity));
      const entity: any = { id: "u1" };

      await saveInverseRelations(entity, "insert", {
        metadata,
        namespace: null,
        parent: undefined,
        repositoryFactory,
        joinTableOps: mockJoinTableOps,
        logger,
      });

      expect(repositoryFactory).not.toHaveBeenCalled();
    });

    test("skips when shouldSave and shouldOrphan are both false", async () => {
      const relation = makeRelation({
        type: "OneToMany",
        joinKeys: null,
        options: {
          ...defaultOptions,
          onInsert: "ignore",
          onUpdate: "ignore",
          onOrphan: "ignore",
        },
      });
      const metadata = makeMetadata(ParentEntity, [relation]);
      mockGetEntityMetadata.mockReturnValue(makeMetadata(ChildEntity));
      const entity: any = { id: "e1", child: [{ id: "c1" }] };

      await saveInverseRelations(entity, "insert", {
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

  describe("OneToMany cascade", () => {
    test("saves all children with FK set pointing back to the parent", async () => {
      const child1: any = { id: "c1" };
      const child2: any = { id: "c2" };
      const savedChild1: any = { id: "c1", version: 1 };
      const savedChild2: any = { id: "c2", version: 1 };
      mockChildRepo.save
        .mockResolvedValueOnce(savedChild1)
        .mockResolvedValueOnce(savedChild2);

      // mirror relation: child has ManyToOne with joinKeys
      const mirrorRelation = makeRelation({
        key: "parent",
        type: "ManyToOne",
        foreignKey: "children",
        foreignConstructor: () => ParentEntity as any,
        joinKeys: { parentId: "id" }, // FK on child
        findKeys: null,
      });

      const relation = makeRelation({
        key: "children",
        type: "OneToMany",
        foreignKey: "parent",
        foreignConstructor: () => ChildEntity as any,
        joinKeys: null,
        findKeys: { parentId: "id" },
        options: { ...defaultOptions, onInsert: "cascade" },
      });

      const metadata = makeMetadata(ParentEntity, [relation]);
      const childMeta = makeMetadata(ChildEntity, [mirrorRelation]);
      mockGetEntityMetadata.mockReturnValue(childMeta);
      const entity: any = { id: "parent-1", children: [child1, child2] };

      await saveInverseRelations(entity, "insert", {
        metadata,
        namespace: null,
        parent: undefined,
        repositoryFactory,
        joinTableOps: mockJoinTableOps,
        logger,
      });

      // FK should be set on both children before save
      expect(child1.parentId).toBe("parent-1");
      expect(child2.parentId).toBe("parent-1");
      expect(mockChildRepo.save).toHaveBeenCalledTimes(2);
      expect(mockChildRepo.save).toHaveBeenCalledWith(child1);
      expect(mockChildRepo.save).toHaveBeenCalledWith(child2);
    });

    test("saves all children including already-persisted ones (version>0) in cascade", async () => {
      const newChild: any = { id: "c-new", version: 0 };
      const existingChild: any = { id: "c-existing", version: 2 };
      const savedNew: any = { id: "c-new", version: 1 };
      const savedExisting: any = { id: "c-existing", version: 3 };
      mockChildRepo.save
        .mockResolvedValueOnce(savedNew)
        .mockResolvedValueOnce(savedExisting);

      const mirrorRelation = makeRelation({
        key: "parent",
        type: "ManyToOne",
        foreignKey: "children",
        foreignConstructor: () => ParentEntity as any,
        joinKeys: { parentId: "id" },
        findKeys: null,
      });

      const relation = makeRelation({
        key: "children",
        type: "OneToMany",
        foreignKey: "parent",
        foreignConstructor: () => ChildEntity as any,
        joinKeys: null,
        findKeys: { parentId: "id" },
        options: { ...defaultOptions, onInsert: "cascade" },
      });

      const metadata = makeMetadata(ParentEntity, [relation]);
      const childMeta = makeMetadata(ChildEntity, [mirrorRelation]);
      mockGetEntityMetadata.mockReturnValue(childMeta);
      const entity: any = { id: "parent-1", children: [newChild, existingChild] };

      await saveInverseRelations(entity, "insert", {
        metadata,
        namespace: null,
        parent: undefined,
        repositoryFactory,
        joinTableOps: mockJoinTableOps,
        logger,
      });

      // FK set on both, and both children are saved
      expect(newChild.parentId).toBe("parent-1");
      expect(existingChild.parentId).toBe("parent-1");
      expect(mockChildRepo.save).toHaveBeenCalledTimes(2);
      expect(mockChildRepo.save).toHaveBeenCalledWith(newChild);
      expect(mockChildRepo.save).toHaveBeenCalledWith(existingChild);
    });

    test("detects and destroys orphan children on update", async () => {
      const child1: any = { id: "c1" };
      const orphan: any = { id: "c-orphan" };
      mockChildRepo.find.mockResolvedValue([child1, orphan]);
      mockChildRepo.save.mockResolvedValue(child1);
      mockChildRepo.destroy.mockResolvedValue(undefined as any);

      const mirrorRelation = makeRelation({
        key: "parent",
        type: "ManyToOne",
        foreignKey: "children",
        foreignConstructor: () => ParentEntity as any,
        joinKeys: { parentId: "id" },
        findKeys: null,
      });

      const relation = makeRelation({
        key: "children",
        type: "OneToMany",
        foreignKey: "parent",
        foreignConstructor: () => ChildEntity as any,
        joinKeys: null,
        findKeys: { parentId: "id" },
        options: { ...defaultOptions, onUpdate: "cascade", onOrphan: "delete" },
      });

      const metadata = makeMetadata(ParentEntity, [relation]);
      mockGetEntityMetadata.mockReturnValue(
        makeMetadata(ChildEntity, [mirrorRelation], ["id"]),
      );
      const entity: any = { id: "parent-1", children: [child1] };

      await saveInverseRelations(entity, "update", {
        metadata,
        namespace: null,
        parent: undefined,
        repositoryFactory,
        joinTableOps: mockJoinTableOps,
        logger,
      });

      // buildRelationFilter is mocked to return { parentId: "e1" }
      expect(mockChildRepo.find).toHaveBeenCalledWith({ parentId: "e1" });
      expect(mockChildRepo.destroy).toHaveBeenCalledTimes(1);
      expect(mockChildRepo.destroy).toHaveBeenCalledWith(orphan);
      expect(mockChildRepo.destroy).not.toHaveBeenCalledWith(child1);
    });

    test("treats empty children array as zero current PKs (all existing become orphans)", async () => {
      const orphan1: any = { id: "c-orphan-1" };
      const orphan2: any = { id: "c-orphan-2" };
      mockChildRepo.find.mockResolvedValue([orphan1, orphan2]);
      mockChildRepo.destroy.mockResolvedValue(undefined as any);

      const mirrorRelation = makeRelation({
        key: "parent",
        type: "ManyToOne",
        foreignKey: "children",
        foreignConstructor: () => ParentEntity as any,
        joinKeys: { parentId: "id" },
        findKeys: null,
      });

      const relation = makeRelation({
        key: "children",
        type: "OneToMany",
        foreignKey: "parent",
        foreignConstructor: () => ChildEntity as any,
        joinKeys: null,
        findKeys: { parentId: "id" },
        options: {
          ...defaultOptions,
          onInsert: "ignore",
          onUpdate: "ignore",
          onOrphan: "delete",
        },
      });

      const metadata = makeMetadata(ParentEntity, [relation]);
      mockGetEntityMetadata.mockReturnValue(
        makeMetadata(ChildEntity, [mirrorRelation], ["id"]),
      );
      const entity: any = { id: "parent-1", children: [] };

      await saveInverseRelations(entity, "update", {
        metadata,
        namespace: null,
        parent: undefined,
        repositoryFactory,
        joinTableOps: mockJoinTableOps,
        logger,
      });

      expect(mockChildRepo.destroy).toHaveBeenCalledTimes(2);
    });
  });

  describe("OneToOne inverse cascade", () => {
    test("saves the child and writes FK back to it", async () => {
      const profile: any = { id: "profile-1" };
      mockChildRepo.save.mockResolvedValue(profile);

      // mirror is the owning side with joinKeys
      const mirrorRelation = makeRelation({
        key: "user",
        type: "OneToOne",
        foreignKey: "profile",
        foreignConstructor: () => ParentEntity as any,
        joinKeys: { userId: "id" },
        findKeys: null,
      });

      const relation = makeRelation({
        key: "profile",
        type: "OneToOne",
        foreignKey: "user",
        foreignConstructor: () => OtherEntity as any,
        joinKeys: null, // inverse side
        findKeys: { userId: "id" },
        options: { ...defaultOptions, onInsert: "cascade" },
      });

      const metadata = makeMetadata(ParentEntity, [relation]);
      mockGetEntityMetadata.mockReturnValue(makeMetadata(OtherEntity, [mirrorRelation]));
      const entity: any = { id: "user-1", profile };

      await saveInverseRelations(entity, "insert", {
        metadata,
        namespace: null,
        parent: undefined,
        repositoryFactory,
        joinTableOps: mockJoinTableOps,
        logger,
      });

      // FK written onto the child
      expect(profile.userId).toBe("user-1");
      expect(mockChildRepo.save).toHaveBeenCalledWith(profile);
    });

    test("skips save when related entity is null", async () => {
      const mirrorRelation = makeRelation({
        key: "user",
        type: "OneToOne",
        foreignKey: "profile",
        foreignConstructor: () => ParentEntity as any,
        joinKeys: { userId: "id" },
        findKeys: null,
      });

      const relation = makeRelation({
        key: "profile",
        type: "OneToOne",
        foreignKey: "user",
        foreignConstructor: () => OtherEntity as any,
        joinKeys: null,
        findKeys: { userId: "id" },
        options: { ...defaultOptions, onInsert: "cascade" },
      });

      const metadata = makeMetadata(ParentEntity, [relation]);
      mockGetEntityMetadata.mockReturnValue(makeMetadata(OtherEntity, [mirrorRelation]));
      const entity: any = { id: "user-1", profile: null };

      await saveInverseRelations(entity, "insert", {
        metadata,
        namespace: null,
        parent: undefined,
        repositoryFactory,
        joinTableOps: mockJoinTableOps,
        logger,
      });

      expect(mockChildRepo.save).not.toHaveBeenCalled();
    });

    test("destroys replaced orphan on update when related is a different entity", async () => {
      const newProfile: any = { id: "profile-new" };
      const existingProfile: any = { id: "profile-old" };
      mockChildRepo.findOne.mockResolvedValue(existingProfile);
      mockChildRepo.save.mockResolvedValue(newProfile);
      mockChildRepo.destroy.mockResolvedValue(undefined as any);

      const mirrorRelation = makeRelation({
        key: "user",
        type: "OneToOne",
        foreignKey: "profile",
        foreignConstructor: () => ParentEntity as any,
        joinKeys: { userId: "id" },
        findKeys: null,
      });

      const relation = makeRelation({
        key: "profile",
        type: "OneToOne",
        foreignKey: "user",
        foreignConstructor: () => OtherEntity as any,
        joinKeys: null,
        findKeys: { userId: "id" },
        options: { ...defaultOptions, onUpdate: "cascade", onOrphan: "delete" },
      });

      const metadata = makeMetadata(ParentEntity, [relation]);
      mockGetEntityMetadata.mockReturnValue(
        makeMetadata(OtherEntity, [mirrorRelation], ["id"]),
      );
      const entity: any = { id: "user-1", profile: newProfile };

      await saveInverseRelations(entity, "update", {
        metadata,
        namespace: null,
        parent: undefined,
        repositoryFactory,
        joinTableOps: mockJoinTableOps,
        logger,
      });

      expect(mockChildRepo.destroy).toHaveBeenCalledWith(existingProfile);
    });

    test("destroys existing when related becomes null on update", async () => {
      const existingProfile: any = { id: "profile-old" };
      mockChildRepo.findOne.mockResolvedValue(existingProfile);
      mockChildRepo.destroy.mockResolvedValue(undefined as any);

      const mirrorRelation = makeRelation({
        key: "user",
        type: "OneToOne",
        foreignKey: "profile",
        foreignConstructor: () => ParentEntity as any,
        joinKeys: { userId: "id" },
        findKeys: null,
      });

      const relation = makeRelation({
        key: "profile",
        type: "OneToOne",
        foreignKey: "user",
        foreignConstructor: () => OtherEntity as any,
        joinKeys: null,
        findKeys: { userId: "id" },
        options: {
          ...defaultOptions,
          onInsert: "ignore",
          onUpdate: "ignore",
          onOrphan: "delete",
        },
      });

      const metadata = makeMetadata(ParentEntity, [relation]);
      mockGetEntityMetadata.mockReturnValue(
        makeMetadata(OtherEntity, [mirrorRelation], ["id"]),
      );
      const entity: any = { id: "user-1", profile: null };

      await saveInverseRelations(entity, "update", {
        metadata,
        namespace: null,
        parent: undefined,
        repositoryFactory,
        joinTableOps: mockJoinTableOps,
        logger,
      });

      expect(mockChildRepo.destroy).toHaveBeenCalledWith(existingProfile);
    });
  });

  describe("ManyToMany cascade", () => {
    test("saves each related entity and calls syncJoinTableRows on insert", async () => {
      const course1: any = { id: "course-1", version: 0 };
      const course2: any = { id: "course-2", version: 0 };
      const savedCourse1: any = { id: "course-1", version: 1 };
      const savedCourse2: any = { id: "course-2", version: 1 };
      mockChildRepo.save
        .mockResolvedValueOnce(savedCourse1)
        .mockResolvedValueOnce(savedCourse2);

      const mirrorRelation = makeRelation({
        key: "students",
        type: "ManyToMany",
        foreignKey: "courses",
        foreignConstructor: () => ParentEntity as any,
        joinKeys: { studentId: "id" },
        findKeys: { courseId: "id" },
        joinTable: "student_x_course",
      });

      const relation = makeRelation({
        key: "courses",
        type: "ManyToMany",
        foreignKey: "students",
        foreignConstructor: () => OtherEntity as any,
        joinKeys: null,
        findKeys: { studentId: "id" },
        joinTable: "student_x_course",
        options: { ...defaultOptions, onInsert: "cascade" },
      });

      const metadata = makeMetadata(ParentEntity, [relation]);
      const foreignMeta = makeMetadata(OtherEntity, [mirrorRelation]);
      mockGetEntityMetadata.mockReturnValue(foreignMeta);
      const entity: any = { id: "student-1", courses: [course1, course2] };

      await saveInverseRelations(entity, "insert", {
        metadata,
        namespace: "myschema",
        parent: undefined,
        repositoryFactory,
        joinTableOps: mockJoinTableOps,
        logger,
      });

      expect(mockChildRepo.save).toHaveBeenCalledTimes(2);
      // After cascade save, relatedEntities array is mutated with saved results
      expect(mockJoinTableOps.sync).toHaveBeenCalledWith(
        entity,
        [savedCourse1, savedCourse2],
        relation,
        mirrorRelation,
        "myschema",
      );
    });

    test("saves all related entities including already-persisted ones (version>0)", async () => {
      const newCourse: any = { id: "course-new", version: 0 };
      const existingCourse: any = { id: "course-existing", version: 1 };
      const savedNewCourse: any = { id: "course-new", version: 1 };
      const savedExistingCourse: any = { id: "course-existing", version: 2 };
      mockChildRepo.save
        .mockResolvedValueOnce(savedNewCourse)
        .mockResolvedValueOnce(savedExistingCourse);

      const mirrorRelation = makeRelation({
        key: "students",
        type: "ManyToMany",
        foreignKey: "courses",
        foreignConstructor: () => ParentEntity as any,
        joinKeys: { studentId: "id" },
        findKeys: { courseId: "id" },
        joinTable: "student_x_course",
      });

      const relation = makeRelation({
        key: "courses",
        type: "ManyToMany",
        foreignKey: "students",
        foreignConstructor: () => OtherEntity as any,
        joinKeys: null,
        findKeys: { studentId: "id" },
        joinTable: "student_x_course",
        options: { ...defaultOptions, onInsert: "cascade" },
      });

      const metadata = makeMetadata(ParentEntity, [relation]);
      const foreignMeta = makeMetadata(OtherEntity, [mirrorRelation]);
      mockGetEntityMetadata.mockReturnValue(foreignMeta);
      const entity: any = { id: "student-1", courses: [newCourse, existingCourse] };

      await saveInverseRelations(entity, "insert", {
        metadata,
        namespace: null,
        parent: undefined,
        repositoryFactory,
        joinTableOps: mockJoinTableOps,
        logger,
      });

      // Both entities should be saved (repo.save() routes insert/update internally)
      expect(mockChildRepo.save).toHaveBeenCalledTimes(2);
      expect(mockChildRepo.save).toHaveBeenCalledWith(newCourse);
      expect(mockChildRepo.save).toHaveBeenCalledWith(existingCourse);
      // joinTableOps.sync gets updated array with both saved results
      expect(mockJoinTableOps.sync).toHaveBeenCalledWith(
        entity,
        [savedNewCourse, savedExistingCourse],
        relation,
        mirrorRelation,
        null,
      );
    });

    test("calls syncJoinTableRows even when no related entities (orphan sync on update)", async () => {
      const mirrorRelation = makeRelation({
        key: "students",
        type: "ManyToMany",
        foreignKey: "courses",
        foreignConstructor: () => ParentEntity as any,
        joinKeys: { studentId: "id" },
        findKeys: { courseId: "id" },
        joinTable: "student_x_course",
      });

      const relation = makeRelation({
        key: "courses",
        type: "ManyToMany",
        foreignKey: "students",
        foreignConstructor: () => OtherEntity as any,
        joinKeys: null,
        findKeys: { studentId: "id" },
        joinTable: "student_x_course",
        options: {
          ...defaultOptions,
          onInsert: "ignore",
          onUpdate: "ignore",
          onOrphan: "delete",
        },
      });

      const metadata = makeMetadata(ParentEntity, [relation]);
      mockGetEntityMetadata.mockReturnValue(makeMetadata(OtherEntity, [mirrorRelation]));
      const entity: any = { id: "student-1", courses: [] };

      await saveInverseRelations(entity, "update", {
        metadata,
        namespace: null,
        parent: undefined,
        repositoryFactory,
        joinTableOps: mockJoinTableOps,
        logger,
      });

      // No save calls since shouldSave is false
      expect(mockChildRepo.save).not.toHaveBeenCalled();
      // But joinTableOps.sync still called for orphan cleanup
      expect(mockJoinTableOps.sync).toHaveBeenCalledWith(
        entity,
        [],
        relation,
        mirrorRelation,
        null,
      );
    });

    test("skips syncJoinTableRows when mirror is not found", async () => {
      const relation = makeRelation({
        key: "courses",
        type: "ManyToMany",
        foreignKey: "students",
        foreignConstructor: () => OtherEntity as any,
        joinKeys: null,
        findKeys: { studentId: "id" },
        joinTable: "student_x_course",
        options: { ...defaultOptions, onInsert: "cascade" },
      });

      const metadata = makeMetadata(ParentEntity, [relation]);
      // Foreign entity has no matching mirror relation
      mockGetEntityMetadata.mockReturnValue(makeMetadata(OtherEntity, []));
      const entity: any = { id: "student-1", courses: [{ id: "c1" }] };

      await saveInverseRelations(entity, "insert", {
        metadata,
        namespace: null,
        parent: undefined,
        repositoryFactory,
        joinTableOps: mockJoinTableOps,
        logger,
      });

      expect(mockJoinTableOps.sync).not.toHaveBeenCalled();
    });
  });

  describe("parent guard", () => {
    test("skips inverse relation when foreignTarget equals parent", async () => {
      // A OneToMany where the child type is the same as our parent caller
      const relation = makeRelation({
        key: "children",
        type: "OneToMany",
        foreignKey: "notMatching",
        foreignConstructor: () => ParentEntity as any,
        joinKeys: null,
        findKeys: { parentId: "id" },
        options: { ...defaultOptions, onInsert: "cascade" },
      });

      // mirror has different keys → not self-referencing
      const mirrorRelation = makeRelation({
        key: "differentKey",
        type: "ManyToOne",
        foreignKey: "differentForeignKey",
        foreignConstructor: () => ChildEntity as any,
        joinKeys: { parentId: "id" },
        findKeys: null,
      });

      const metadata = makeMetadata(ChildEntity, [relation]);
      mockGetEntityMetadata.mockReturnValue(makeMetadata(ParentEntity, [mirrorRelation]));
      const entity: any = { id: "e1", children: [{ id: "c1" }] };

      await saveInverseRelations(entity, "insert", {
        metadata,
        namespace: null,
        parent: ParentEntity as any,
        repositoryFactory,
        joinTableOps: mockJoinTableOps,
        logger,
      });

      expect(repositoryFactory).not.toHaveBeenCalled();
    });
  });
});
