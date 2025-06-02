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
  PrimaryKeyColumn,
  UpdateDateColumn,
  VersionColumn,
  VersionEndDateColumn,
  VersionKeyColumn,
  VersionStartDateColumn,
} from "../decorators";
import { defaultCreateEntity } from "./default-create-entity";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

jest.mock("crypto", () => ({
  ...jest.requireActual("crypto"),
  randomUUID: jest
    .fn()
    .mockImplementation(() => "c8ff3952-8ba4-51a3-a4d5-2f0726c49524")
    .mockImplementationOnce(() => "e8edbe03-f52f-56c6-8d98-82e6961329fe")
    .mockImplementationOnce(() => "0c8c31df-f1cc-5381-97fc-31b3714327de")
    .mockImplementationOnce(() => "2dc92d72-9ce3-50c7-b982-59022ec393f1")
    .mockImplementationOnce(() => "88943033-fef1-5ad8-8cf8-4470be80d197")
    .mockImplementationOnce(() => "1d37a07d-4fd6-5913-85eb-2c7d721cf2a9")
    .mockImplementationOnce(() => "5f2976d2-afda-5e28-9c06-3c04865ea8df"),
}));

describe("defaultCreateEntity", () => {
  test("should create with empty values", () => {
    enum TestEnum {
      One = "1",
      Two = "2",
    }

    @Entity()
    @OnCreate((entity) => {
      entity.OnCreate = "OnCreate";
    })
    class TestCreateEntityEmpty {
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

      @VersionEndDateColumn()
      versionEndDate!: Date | null;

      @VersionKeyColumn()
      versionKey!: string;

      @VersionStartDateColumn()
      versionStartDate!: Date;

      @Column("array")
      array!: any[];

      @Column("bigint")
      bigint!: bigint;

      @Column("boolean")
      boolean!: boolean;

      @Column("date")
      date!: Date;

      @Column("enum", { enum: TestEnum })
      enum!: TestEnum;

      @Column("integer")
      number!: number;

      @Column("object")
      object!: Dict;

      @Column("string")
      string!: string;

      @Column("uuid")
      uuid!: string;
    }

    expect(defaultCreateEntity(TestCreateEntityEmpty)).toMatchSnapshot();
  });

  test("should create with fallback values", () => {
    enum TestEnum {
      One = "1",
      Two = "2",
    }

    @Entity()
    class TestCreateEntityFallback {
      @PrimaryKeyColumn()
      id!: string;

      @Column("array", { fallback: [] })
      array!: any[];

      @Column("bigint", { fallback: BigInt(0) })
      bigint!: bigint;

      @Column("boolean", { fallback: false })
      boolean!: boolean;

      @Column("date", { fallback: () => new Date() })
      date!: Date;

      @Column("enum", { enum: TestEnum, fallback: TestEnum.One })
      enum!: TestEnum;

      @Column("integer", { fallback: 0 })
      number!: number;

      @Column("object", { fallback: {} })
      object!: Dict;

      @Column("string", { fallback: "string" })
      string!: string;

      @Column("uuid", { fallback: "00000000-0000-0000-0000-000000000000" })
      uuid!: string;
    }

    expect(defaultCreateEntity(TestCreateEntityFallback)).toMatchSnapshot();
  });

  test("should create with options values", () => {
    enum TestEnum {
      One = "1",
      Two = "2",
    }

    @Entity()
    class TestCreateEntityOptions {
      @PrimaryKeyColumn()
      id!: string;

      @Column("array", { fallback: [] })
      array!: any[];

      @Column("bigint", { fallback: BigInt(0) })
      bigint!: bigint;

      @Column("boolean", { fallback: false })
      boolean!: boolean;

      @Column("date", { fallback: new Date() })
      date!: Date;

      @Column("enum", { enum: TestEnum, fallback: TestEnum.One })
      enum!: TestEnum;

      @Column("integer", { fallback: 0 })
      number!: number;

      @Column("object", { fallback: {} })
      object!: Dict;

      @Column("string", { fallback: "string" })
      string!: string;

      @Column("uuid", { fallback: "00000000-0000-0000-0000-000000000000" })
      uuid!: string;
    }

    expect(
      defaultCreateEntity(TestCreateEntityOptions, {
        array: [1, 2, 3],
        bigint: BigInt(1),
        boolean: true,
        date: new Date("2025-01-01T00:00:00.000Z"),
        enum: TestEnum.Two,
        number: 1,
        object: { key: "value" },
        string: "value",
        uuid: "00000000-0000-0000-0000-000000000001",
      }),
    ).toMatchSnapshot();
  });
});
