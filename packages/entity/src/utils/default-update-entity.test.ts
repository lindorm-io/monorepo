import MockDate from "mockdate";
import {
  Column,
  Entity,
  PrimaryKeyColumn,
  UpdateDateColumn,
  VersionColumn,
} from "../decorators";
import { defaultCloneEntity } from "./default-clone-entity";
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

describe("defaultUpdateEntity", () => {
  test("should update existing entity", () => {
    @Entity()
    class TestUpdateEntity {
      @PrimaryKeyColumn()
      id!: string;

      @VersionColumn()
      version!: number;

      @UpdateDateColumn()
      updateDate!: Date;

      @Column("array", { fallback: [] })
      array!: any[];

      @Column("bigint", { fallback: BigInt(0) })
      bigint!: bigint;

      @Column("boolean", { fallback: false })
      boolean!: boolean;

      @Column("object", { fallback: {} })
      object!: Record<string, any>;
    }

    const original = defaultCreateEntity<TestUpdateEntity>(TestUpdateEntity, {
      version: 8,
      array: [1, 2, 3],
      bigint: BigInt(1),
      boolean: true,
      updateDate: new Date("2023-01-01T00:00:00.000Z"),
      object: { key: "value" },
    });

    expect(defaultCloneEntity(TestUpdateEntity, original)).toMatchSnapshot();
  });
});
