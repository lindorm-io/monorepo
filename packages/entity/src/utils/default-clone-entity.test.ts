import MockDate from "mockdate";
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  ExpiryDateColumn,
  Generated,
  PrimaryKeyColumn,
  Unique,
  UpdateDateColumn,
  VersionColumn,
  VersionEndDateColumn,
  VersionKeyColumn,
  VersionStartDateColumn,
} from "../decorators";
import { defaultCloneEntity } from "./default-clone-entity";
import { defaultCreateEntity } from "./default-create-entity";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

jest.mock("crypto", () => ({
  ...jest.requireActual("crypto"),
  randomBytes: jest
    .fn()
    .mockImplementation(() => Buffer.from("c8ff39528ba451a3a4d52f0726c49524", "hex")),
  randomInt: jest.fn().mockImplementation(() => 123456),
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

describe("defaultCloneEntity", () => {
  test("should clone existing entity", () => {
    enum TestEnum {
      One = "1",
      Two = "2",
    }

    @Entity()
    class TestCloneEntity {
      @PrimaryKeyColumn()
      primaryKey!: string;

      @VersionColumn()
      version!: number;

      @VersionKeyColumn()
      versionKey!: string;

      @VersionStartDateColumn()
      startDate!: Date;

      @VersionEndDateColumn()
      endDate!: Date;

      @CreateDateColumn()
      createDate!: Date;

      @DeleteDateColumn()
      deleteDate!: Date;

      @ExpiryDateColumn()
      expiryDate!: Date;

      @UpdateDateColumn()
      updateDate!: Date;

      @Column("array", { fallback: [] })
      array!: any[];

      @Column("bigint", { fallback: BigInt(0) })
      bigint!: bigint;

      @Column("boolean", { fallback: false })
      boolean!: boolean;

      @Column("enum", { enum: TestEnum, fallback: TestEnum.One })
      enum!: TestEnum;

      @Column("object", { fallback: {} })
      object!: Record<string, any>;

      @Column("string")
      @Unique()
      unique!: string;

      @Column("date")
      @Generated("date")
      generatedDate!: Date;

      @Column("integer")
      @Generated("integer")
      generatedNumber!: number;

      @Column("string")
      @Generated("string")
      generatedString!: string;

      @Column("uuid")
      @Generated("uuid")
      generatedUuid!: string;

      @Column("integer")
      @Generated("increment")
      increment!: number;
    }

    const original = defaultCreateEntity(TestCloneEntity, {
      array: [1, 2, 3],
      bigint: BigInt(1),
      boolean: true,
      createDate: new Date("2023-01-01T00:00:00.000Z"),
      deleteDate: new Date("2023-01-01T00:00:00.000Z"),
      enum: TestEnum.Two,
      expiryDate: new Date("2023-01-01T00:00:00.000Z"),
      generatedDate: new Date("2025-01-01T00:00:00.000Z"),
      generatedNumber: 1,
      generatedString: "value",
      generatedUuid: "00000000-0000-0000-0000-000000000001",
      increment: 124,
      object: { key: "value" },
      primaryKey: "18a6cae3-0922-51f7-b835-35c128b0a086",
      unique: "unique",
      updateDate: new Date("2023-01-01T00:00:00.000Z"),
      version: 8,
      versionKey: "5142a228-9092-56cb-9dba-2571d7392b29",
    });

    expect(defaultCloneEntity(TestCloneEntity, original)).toMatchSnapshot();
  });
});
