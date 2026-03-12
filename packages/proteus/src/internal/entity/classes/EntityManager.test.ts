import { EntityManager } from "./EntityManager";
import { AfterDestroy } from "../../../decorators/AfterDestroy";
import { AfterInsert } from "../../../decorators/AfterInsert";
import { AfterLoad } from "../../../decorators/AfterLoad";
import { AfterSave } from "../../../decorators/AfterSave";
import { AfterUpdate } from "../../../decorators/AfterUpdate";
import { BeforeDestroy } from "../../../decorators/BeforeDestroy";
import { BeforeInsert } from "../../../decorators/BeforeInsert";
import { BeforeSave } from "../../../decorators/BeforeSave";
import { BeforeUpdate } from "../../../decorators/BeforeUpdate";
import { CreateDateField } from "../../../decorators/CreateDateField";
import { Entity } from "../../../decorators/Entity";
import { Field } from "../../../decorators/Field";
import { Generated } from "../../../decorators/Generated";
import { ManyToOne } from "../../../decorators/ManyToOne";
import { OnCreate } from "../../../decorators/OnCreate";
import { OneToMany } from "../../../decorators/OneToMany";
import { PrimaryKey } from "../../../decorators/PrimaryKey";
import { PrimaryKeyField } from "../../../decorators/PrimaryKeyField";
import { UpdateDateField } from "../../../decorators/UpdateDateField";
import { VersionEndDateField } from "../../../decorators/VersionEndDateField";
import { VersionField } from "../../../decorators/VersionField";
import { VersionKeyField } from "../../../decorators/VersionKeyField";
import { VersionStartDateField } from "../../../decorators/VersionStartDateField";

const emHookCb = jest.fn();

@Entity({ name: "EMOrderItem" })
class EMOrderItem {
  @PrimaryKeyField()
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Field("string")
  sku!: string;

  @ManyToOne(() => EMOrder, "items")
  order!: EMOrder | null;

  orderId!: string | null;
}

@Entity({ name: "EMOrder" })
@OnCreate(emHookCb)
@BeforeInsert(emHookCb)
@BeforeSave(emHookCb)
@BeforeUpdate(emHookCb)
@BeforeDestroy(emHookCb)
@AfterInsert(emHookCb)
@AfterSave(emHookCb)
@AfterUpdate(emHookCb)
@AfterDestroy(emHookCb)
@AfterLoad(emHookCb)
class EMOrder {
  @PrimaryKeyField()
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Field("string")
  name!: string;

  @OneToMany(() => EMOrderItem, "order")
  items!: EMOrderItem[];
}

@Entity({ name: "EMNoDriver" })
class EMNoDriver {
  @PrimaryKey()
  @Field("uuid")
  id!: string;

  @Field("string")
  name!: string;
}

@Entity({ name: "EMWithIncrement" })
class EMWithIncrement {
  @PrimaryKey()
  @Field("integer")
  @Generated("increment")
  id!: number;

  @Field("string")
  name!: string;
}

@Entity({ name: "EMVersioned" })
class EMVersioned {
  @PrimaryKey()
  @Field("uuid")
  @Generated("uuid")
  id!: string;

  @VersionKeyField()
  versionId!: string;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @VersionStartDateField()
  startAt!: Date;

  @VersionEndDateField()
  endAt!: Date | null;

  @Field("string")
  name!: string;
}

const makeOrderManager = () => new EntityManager({ target: EMOrder, driver: "postgres" });

describe("EntityManager", () => {
  describe("constructor", () => {
    test("should construct with valid target and driver", () => {
      expect(() => makeOrderManager()).not.toThrow();
    });

    test("should throw when target is missing", () => {
      expect(
        () => new EntityManager({ target: undefined as any, driver: "postgres" }),
      ).toThrow("EntityManager requires a target constructor");
    });

    test("should throw when driver is missing", () => {
      expect(() => new EntityManager({ target: EMOrder, driver: "" })).toThrow(
        "EntityManager requires a driver parameter",
      );
    });

    test("should throw when entity has no @Entity decorator", () => {
      class NoEntityDecorator {}
      expect(
        () => new EntityManager({ target: NoEntityDecorator as any, driver: "postgres" }),
      ).toThrow();
    });

    test("should throw when increment entity has no getNextIncrement on non-postgres driver", () => {
      expect(
        () => new EntityManager({ target: EMWithIncrement, driver: "mongo" }),
      ).toThrow("no getNextIncrement function was provided");
    });

    test("should not throw when increment entity has no getNextIncrement on postgres driver", () => {
      expect(
        () => new EntityManager({ target: EMWithIncrement, driver: "postgres" }),
      ).not.toThrow();
    });

    test("should not throw when increment entity has getNextIncrement", () => {
      const getNextIncrement = jest.fn().mockResolvedValue(1);
      expect(
        () =>
          new EntityManager({
            target: EMWithIncrement,
            driver: "postgres",
            getNextIncrement,
          }),
      ).not.toThrow();
    });
  });

  describe("updateStrategy", () => {
    test("should be 'update' for standard entity", () => {
      const manager = makeOrderManager();
      expect(manager.updateStrategy).toBe("update");
    });

    test("should be 'update' for entity without version keys", () => {
      const manager = new EntityManager({ target: EMNoDriver, driver: "postgres" });
      expect(manager.updateStrategy).toBe("update");
    });

    test("should be 'version' when entity has VersionKey", () => {
      const manager = new EntityManager({ target: EMVersioned, driver: "postgres" });
      expect(manager.updateStrategy).toBe("version");
    });
  });

  describe("create", () => {
    test("should create an entity instance", () => {
      const manager = makeOrderManager();
      const entity = manager.create({ name: "Test Order" });
      expect(entity).toBeInstanceOf(EMOrder);
      expect(entity.name).toBe("Test Order");
    });

    test("should call OnCreate hooks", () => {
      emHookCb.mockClear();
      const manager = makeOrderManager();
      manager.create({ name: "Test" });
      expect(emHookCb).toHaveBeenCalled();
    });
  });

  describe("copy", () => {
    test("should create a copy of an entity", () => {
      const manager = makeOrderManager();
      const original = manager.create({ name: "Original" });
      const copy = manager.copy(original);
      expect(copy).toBeInstanceOf(EMOrder);
      expect(copy.name).toBe("Original");
    });
  });

  describe("document", () => {
    test("should create a raw document from entity", () => {
      const manager = makeOrderManager();
      const entity = manager.create({ id: "order-1", name: "Test" });
      const doc = manager.document(entity);
      expect(doc.id).toBe("order-1");
      expect(doc.name).toBe("Test");
      expect(doc).not.toHaveProperty("items");
    });
  });

  describe("insert", () => {
    test("should prepare entity for insert (version=1)", async () => {
      const manager = makeOrderManager();
      const entity = manager.create({ name: "Test" });
      entity.version = 0;
      const inserted = await manager.insert(entity);
      expect(inserted.version).toBe(1);
    });

    test("should call getNextIncrement for increment-strategy fields", async () => {
      const getNextIncrement = jest.fn().mockResolvedValue(42);
      const manager = new EntityManager({
        target: EMWithIncrement,
        driver: "postgres",
        getNextIncrement,
      });
      const entity = manager.create({ name: "Test" });

      const inserted = await manager.insert(entity);

      expect(getNextIncrement).toHaveBeenCalledWith("id");
      expect(inserted.id).toBe(42);
    });

    test("should not call getNextIncrement when field already has a positive value", async () => {
      const getNextIncrement = jest.fn().mockResolvedValue(99);
      const manager = new EntityManager({
        target: EMWithIncrement,
        driver: "postgres",
        getNextIncrement,
      });
      const entity = manager.create({ name: "Test", id: 5 } as any);

      const inserted = await manager.insert(entity);

      expect(getNextIncrement).not.toHaveBeenCalled();
      expect(inserted.id).toBe(5);
    });
  });

  describe("update", () => {
    test("should increment version", () => {
      const manager = makeOrderManager();
      const entity = manager.create({ name: "Test" });
      entity.version = 2;
      const updated = manager.update(entity);
      expect(updated.version).toBe(3);
    });
  });

  describe("hooks", () => {
    test("should call BeforeInsert hook", () => {
      emHookCb.mockClear();
      const manager = makeOrderManager();
      const entity = manager.create({ name: "Test" });
      manager.beforeInsert(entity);
      expect(emHookCb).toHaveBeenCalled();
    });

    test("should call hooks for any driver", () => {
      const manager = new EntityManager({ target: EMOrder, driver: "redis" });
      const entity = manager.create({ name: "Test" });
      // clear after create() so the OnCreate hook call doesn't count
      emHookCb.mockClear();
      manager.beforeInsert(entity);
      expect(emHookCb).toHaveBeenCalled();
    });

    test("should call AfterLoad hook", () => {
      emHookCb.mockClear();
      const manager = new EntityManager({ target: EMOrder, driver: "redis" });
      const entity = manager.create({ name: "Test" });
      manager.afterLoad(entity);
      expect(emHookCb).toHaveBeenCalled();
    });

    test("should call BeforeUpdate hook", () => {
      emHookCb.mockClear();
      const manager = makeOrderManager();
      const entity = manager.create({ name: "Test" });
      manager.beforeUpdate(entity);
      expect(emHookCb).toHaveBeenCalled();
    });

    test("should call BeforeDestroy hook", () => {
      emHookCb.mockClear();
      const manager = makeOrderManager();
      const entity = manager.create({ name: "Test" });
      manager.beforeDestroy(entity);
      expect(emHookCb).toHaveBeenCalled();
    });

    test("should call AfterInsert hook", () => {
      emHookCb.mockClear();
      const manager = makeOrderManager();
      const entity = manager.create({ name: "Test" });
      manager.afterInsert(entity);
      expect(emHookCb).toHaveBeenCalled();
    });

    test("should call AfterUpdate hook", () => {
      emHookCb.mockClear();
      const manager = makeOrderManager();
      const entity = manager.create({ name: "Test" });
      manager.afterUpdate(entity);
      expect(emHookCb).toHaveBeenCalled();
    });

    test("should call BeforeSave hook", () => {
      emHookCb.mockClear();
      const manager = makeOrderManager();
      const entity = manager.create({ name: "Test" });
      manager.beforeSave(entity);
      expect(emHookCb).toHaveBeenCalled();
    });

    test("should call AfterSave hook", () => {
      emHookCb.mockClear();
      const manager = makeOrderManager();
      const entity = manager.create({ name: "Test" });
      manager.afterSave(entity);
      expect(emHookCb).toHaveBeenCalled();
    });

    test("should call AfterDestroy hook", () => {
      emHookCb.mockClear();
      const manager = makeOrderManager();
      const entity = manager.create({ name: "Test" });
      manager.afterDestroy(entity);
      expect(emHookCb).toHaveBeenCalled();
    });
  });

  describe("getEntityName", () => {
    test("should return scoped name for entity", () => {
      const manager = makeOrderManager();
      const result = manager.getEntityName({});
      expect(result.name).toBe("EMOrder");
      expect(result.type).toBe("entity");
    });
  });

  describe("getIncrementName", () => {
    test("should return scoped name for increment", () => {
      const manager = makeOrderManager();
      const result = manager.getIncrementName({});
      expect(result.name).toBe("EMOrder");
      expect(result.type).toBe("increment");
    });
  });

  describe("getSaveStrategy", () => {
    test("should return insert when version=0", () => {
      const manager = makeOrderManager();
      const entity = manager.create({ name: "Test" });
      entity.version = 0;
      expect(manager.getSaveStrategy(entity)).toBe("insert");
    });

    test("should return update when version>0", () => {
      const manager = makeOrderManager();
      const entity = manager.create({ name: "Test" });
      entity.version = 1;
      expect(manager.getSaveStrategy(entity)).toBe("update");
    });
  });

  describe("relationFilter", () => {
    test("should build filter from findKeys and entity", () => {
      const manager = makeOrderManager();
      const meta = manager.metadata;
      const relation = meta.relations.find((r) => r.key === "items");
      expect(relation).toBeDefined();
      const entity = manager.create({ id: "order-1", name: "Test" });
      const filter = manager.relationFilter(relation!, entity);
      expect(filter).toBeDefined();
    });
  });

  describe("removeReadonly", () => {
    test("should remove readonly fields", () => {
      const manager = makeOrderManager();
      const entity = manager.create({ name: "Test" });
      const result = manager.removeReadonly(entity);
      // id has readonly=true (PrimaryKeyField)
      expect(result).not.toHaveProperty("id");
    });
  });

  describe("validate", () => {
    test("should not throw for valid entity", () => {
      const manager = makeOrderManager();
      const entity = manager.create({
        id: "550e8400-e29b-41d4-a716-446655440000",
        version: 1,
        name: "Valid",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
      expect(() => manager.validate(entity)).not.toThrow();
    });
  });

  describe("verifyReadonly", () => {
    test("should not throw for non-readonly update", () => {
      const manager = makeOrderManager();
      expect(() => manager.verifyReadonly({ name: "Updated" })).not.toThrow();
    });

    test("should throw when updating readonly field", () => {
      const manager = makeOrderManager();
      expect(() => manager.verifyReadonly({ id: "new-id" })).toThrow("Field is readonly");
    });
  });

  describe("versionCopy", () => {
    test("should create version copy with swapped start/end dates", () => {
      const manager = new EntityManager({ target: EMVersioned, driver: "postgres" });
      const entity = manager.create({ name: "Test" } as any);
      entity.startAt = new Date("2024-01-01");
      entity.endAt = new Date("2024-06-01");
      (entity as any).id = "test-id";
      (entity as any).version = 1;

      // original carries the endAt that becomes the copy's startAt
      const original = { endAt: new Date("2024-06-01") };
      const copy = manager.versionCopy(original as any, entity);
      // versionCopy: copy.startAt = original.endAt, copy.endAt = null
      expect(copy.startAt).toEqual(new Date("2024-06-01"));
      expect(copy.endAt).toBeNull();
    });

    test("should throw when VersionStartDate not decorated", () => {
      const manager = makeOrderManager();
      const entity = manager.create({ name: "Test" });
      expect(() => manager.versionCopy({}, entity)).toThrow(
        "versionCopy requires @VersionStartDate decorator",
      );
    });
  });

  describe("versionUpdate", () => {
    test("should return partial entity with endAt set", () => {
      const manager = new EntityManager({ target: EMVersioned, driver: "postgres" });
      const entity = manager.create({ name: "Test" } as any);
      const update = manager.versionUpdate(entity);
      expect(update).toHaveProperty("endAt");
    });
  });

  describe("clone", () => {
    test("should return a cloned entity with version=1", async () => {
      const manager = makeOrderManager();
      const entity = manager.create({ name: "Original", id: "original-id" } as any);
      entity.version = 3;
      const clone = await manager.clone(entity);
      expect(clone).toBeInstanceOf(EMOrder);
      expect(clone.version).toBe(1);
    });
  });
});
