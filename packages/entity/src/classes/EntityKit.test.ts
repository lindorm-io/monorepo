import { createMockLogger } from "@lindorm/logger";
import { Dict } from "@lindorm/types";
import MockDate from "mockdate";
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  ExpiryDateColumn,
  Generated,
  OnCreate,
  OnDestroy,
  OnInsert,
  OnUpdate,
  OnValidate,
  PrimaryKeyColumn,
  PrimarySource,
  UpdateDateColumn,
  VersionColumn,
  VersionEndDateColumn,
  VersionKeyColumn,
  VersionStartDateColumn,
} from "../decorators";
import { IEntity } from "../interfaces";
import { EntityKit } from "./EntityKit";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

jest.mock("crypto", () => ({
  ...jest.requireActual("crypto"),
  randomBytes: jest
    .fn()
    .mockImplementation(() => Buffer.from("c8ff39528ba451a3a4d52f0726c49524", "hex")),
  randomInt: jest.fn().mockImplementation(() => 123456),
  randomUUID: jest.fn().mockImplementation(() => "c8ff3952-8ba4-51a3-a4d5-2f0726c49524"),
}));

describe("EntityKit", () => {
  let kit: EntityKit<IEntity>;
  let kitVer: EntityKit<IEntity>;

  @Entity()
  @PrimarySource("RedisSource")
  @OnCreate((entity) => {
    entity.OnCreate = "OnCreate";
  })
  @OnDestroy((entity) => {
    entity.OnDestroy = "OnDestroy";
  })
  @OnInsert((entity) => {
    entity.OnInsert = "OnInsert";
  })
  @OnUpdate((entity) => {
    entity.OnUpdate = "OnUpdate";
  })
  @OnValidate((entity) => {
    entity.OnValidate = "OnValidate";
  })
  class TestEntityUtility {
    @PrimaryKeyColumn()
    primaryKey!: string;

    @CreateDateColumn()
    createdDate!: Date;

    @DeleteDateColumn()
    deletedDate!: Date | null;

    @ExpiryDateColumn()
    expiryDate!: Date | null;

    @Column()
    @Generated("increment")
    sequence!: number;

    @UpdateDateColumn()
    updatedDate!: Date;

    @VersionColumn()
    version!: number;

    @Column("array")
    array!: any[];

    @Column("bigint")
    bigint!: bigint;

    @Column("boolean")
    boolean!: boolean;

    @Column("date")
    date!: Date;

    @Column("integer")
    number!: number;

    @Column("object")
    object!: Dict;

    @Column("string", { readonly: true })
    string!: string;

    @Column("uuid")
    uuid!: string;

    @Column()
    OnCreate!: string;
  }

  @Entity()
  @PrimarySource("MongoSource")
  class TestEntityUtilityVersioned {
    @PrimaryKeyColumn()
    primaryKey!: string;

    @CreateDateColumn()
    createdDate!: Date;

    @UpdateDateColumn()
    updatedDate!: Date;

    @VersionColumn()
    version!: number;

    @VersionEndDateColumn()
    versionEndDate!: Date | null;

    @VersionKeyColumn()
    versionKey!: string;

    @VersionStartDateColumn()
    versionStartDate!: Date;
  }

  beforeEach(() => {
    kit = new EntityKit({
      target: TestEntityUtility,
      logger: createMockLogger(),
      source: "RedisSource",
      getNextIncrement: jest.fn().mockResolvedValue(999),
    });
    kitVer = new EntityKit({
      target: TestEntityUtilityVersioned,
      logger: createMockLogger(),
      source: "MongoSource",
      getNextIncrement: jest.fn().mockResolvedValue(999),
    });
  });

  test("should calculate entity", () => {
    expect(kit.isPrimarySource).toEqual(true);
    expect(kit.metadata).toMatchSnapshot();
    expect(kit.updateStrategy).toEqual("update");
  });

  test("should calculate versioned entity", () => {
    expect(kitVer.isPrimarySource).toEqual(true);
    expect(kitVer.metadata).toMatchSnapshot();
    expect(kitVer.updateStrategy).toEqual("version");
  });

  test("should calculate primary source", () => {
    kit = new EntityKit({
      target: TestEntityUtility,
      logger: createMockLogger(),
      source: "MnemosSource",
      getNextIncrement: jest.fn().mockResolvedValue(999),
    });
    expect(kit.isPrimarySource).toEqual(false);
  });

  test("should resolve create", () => {
    expect(kit.create()).toMatchSnapshot();
  });

  test("should resolve clone", () => {
    expect(kit.clone(kit.create())).toMatchSnapshot();
  });

  test("should resolve insert", () => {
    expect(kit.insert(kit.create())).toMatchSnapshot();
  });

  test("should resolve update", () => {
    expect(kit.update(kit.create())).toMatchSnapshot();
  });

  test("should resolve versionCopy", () => {
    expect(kitVer.versionCopy(kitVer.create(), kitVer.create())).toMatchSnapshot();
  });

  test("should resolve versionUpdate", () => {
    expect(kitVer.versionUpdate(kitVer.create())).toMatchSnapshot();
  });

  test("should resolve collection name", () => {
    expect(kit.getCollectionName({})).toEqual("entity.test_entity_utility");
  });

  test("should resolve increment name", () => {
    expect(kit.getIncrementName({})).toEqual("increment.test_entity_utility");
  });

  test("should resolve save strategy", () => {
    expect(kit.getSaveStrategy(kit.create())).toEqual("insert");
  });

  test("should resolve insert hooks", () => {
    const entity = kit.create();
    expect(kit.onInsert(entity)).toBeUndefined();
    expect(entity).toMatchSnapshot();
  });

  test("should resolve update hooks", () => {
    const entity = kit.create();
    expect(kit.onUpdate(entity)).toBeUndefined();
    expect(entity).toMatchSnapshot();
  });

  test("should resolve destroy hooks", () => {
    const entity = kit.create();
    expect(kit.onDestroy(entity)).toBeUndefined();
    expect(entity).toMatchSnapshot();
  });

  test("should remove readonly", () => {
    expect(kit.removeReadonly(kit.create())).toMatchSnapshot();
  });

  test("should validate", () => {
    expect(() => kit.validate(kit.create())).toThrow();
  });

  test("should verify readonly", () => {
    expect(() => kit.verifyReadonly(kit.create())).toThrow();
  });
});
