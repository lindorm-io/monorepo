import { Dict } from "@lindorm/types";
import MockDate from "mockdate";
import { TestRelationOne, TestRelationTwo } from "../__fixtures__/test-relations";
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

  describe("with relations", () => {
    let entity: TestRelationOne;

    beforeEach(() => {
      entity = defaultCreateEntity(TestRelationOne, {
        name: "one",
        twos: [
          {
            first: "two-1-first",
            second: "two-1-second",
            name: "two-1",
            threes: [
              {
                name: "three-1",
              },
              {
                name: "three-2",
              },
            ],
          },
          {
            first: "two-2-first",
            second: "two-2-second",
            name: "two-2",
            threes: [
              {
                name: "three-3",
              },
            ],
          },
        ],
        four: { name: "four" },
      });
    });

    test("should create with relation values", () => {
      expect(entity).toEqual(
        expect.objectContaining({
          name: "one",
          twos: [
            expect.objectContaining({
              name: "two-1",
              // Direction A: parent (OneToMany) sets child back-ref
              threes: [
                expect.objectContaining({
                  name: "three-1",
                  two: entity.twos[0],
                }),
                expect.objectContaining({
                  name: "three-2",
                  two: entity.twos[0],
                }),
              ],
            }),
            expect.objectContaining({
              name: "two-2",
              threes: [
                expect.objectContaining({
                  name: "three-3",
                  two: entity.twos[1],
                }),
              ],
            }),
          ],
          four: expect.objectContaining({
            name: "four",
          }),
        }),
      );
    });

    test("should set Direction A back-reference on inverse OneToOne", () => {
      // Inverse OneToOne: parent sets child.one = parent (Direction A)
      expect(entity.four.one).toEqual(entity);
    });

    test("should set Direction A back-references on OneToMany children", () => {
      // Parent's OneToMany processing sets child.one = parent
      expect(entity.twos[0].one).toEqual(entity);
      expect(entity.twos[1].one).toEqual(entity);

      // Nested: Parent's OneToMany processing sets child.two = parent
      expect(entity.twos[0].threes[0].two).toEqual(entity.twos[0]);
      expect(entity.twos[0].threes[1].two).toEqual(entity.twos[0]);
      expect(entity.twos[1].threes[0].two).toEqual(entity.twos[1]);
    });

    test("should populate FK columns via Direction A findKeys", () => {
      // OneToMany: parent populates child FK columns from findKeys
      expect(entity.twos[0].customOneId).toEqual(entity.id);
      expect(entity.twos[1].customOneId).toEqual(entity.id);

      // Nested: auto-inferred FK columns
      expect(entity.twos[0].threes[0].twoFirst).toEqual(entity.twos[0].first);
      expect(entity.twos[0].threes[0].twoSecond).toEqual(entity.twos[0].second);

      // Inverse OneToOne: parent populates child FK columns from findKeys
      expect(entity.four.customFourId).toEqual(entity.id);
    });

    test("should create with deep relation", () => {
      const two = defaultCreateEntity(TestRelationTwo, {
        name: "two-3",
        one: entity,
      });

      expect(two).toEqual(
        expect.objectContaining({
          name: "two-3",
          one: entity,
          threes: [],
        }),
      );
    });

    test("should not mutate existing instances passed as relations", () => {
      const existingTwo = defaultCreateEntity(TestRelationTwo, {
        first: "existing-first",
        second: "existing-second",
        name: "existing",
      });

      const originalOne = existingTwo.one;

      defaultCreateEntity(TestRelationOne, {
        name: "new-parent",
        twos: [existingTwo],
      });

      // existingTwo.one should not have been changed
      expect(existingTwo.one).toEqual(originalOne);
    });

    test("should not stack overflow on circular plain-object input", () => {
      const circular: any = { name: "circular" };
      const circularTwo: any = {
        first: "c-first",
        second: "c-second",
        name: "circular-two",
        one: circular,
      };
      circular.twos = [circularTwo];

      expect(() => defaultCreateEntity(TestRelationOne, circular)).not.toThrow();
    });

    test("should preserve array integrity on OneToMany with multiple children", () => {
      const result = defaultCreateEntity(TestRelationOne, {
        name: "parent",
        twos: [
          { first: "a", second: "a", name: "child-1" },
          { first: "b", second: "b", name: "child-2" },
          { first: "c", second: "c", name: "child-3" },
        ],
      });

      expect(Array.isArray(result.twos)).toEqual(true);
      expect(result.twos).toHaveLength(3);
      expect(result.twos.map((t: any) => t.name)).toEqual([
        "child-1",
        "child-2",
        "child-3",
      ]);
    });
  });
});
