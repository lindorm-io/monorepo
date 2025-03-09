import {
  Column,
  Entity,
  Generated,
  PrimaryKeyColumn,
  VersionColumn,
} from "../decorators";
import { defaultCreateEntity } from "./default-create-entity";
import { getSaveStrategy } from "./get-save-strategy";

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

describe("getSaveStrategy", () => {
  test("should resolve insert", () => {
    @Entity()
    class TestEntityVersionEmpty {
      @PrimaryKeyColumn()
      id!: string;

      @VersionColumn()
      version!: number;
    }

    expect(
      getSaveStrategy(
        TestEntityVersionEmpty,
        defaultCreateEntity(TestEntityVersionEmpty),
      ),
    ).toEqual("insert");
  });

  test("should resolve update", () => {
    @Entity()
    class TestEntityVersionExists {
      @PrimaryKeyColumn()
      id!: string;

      @VersionColumn()
      version!: number;
    }

    expect(
      getSaveStrategy(
        TestEntityVersionExists,
        defaultCreateEntity(TestEntityVersionExists, {
          version: 1,
        }),
      ),
    ).toEqual("update");
  });

  test("should resolve insert", () => {
    @Entity()
    class TestEntityGenerateEmpty {
      @PrimaryKeyColumn()
      id!: string;

      @Column()
      @Generated("increment")
      increment!: number;
    }

    expect(
      getSaveStrategy(
        TestEntityGenerateEmpty,
        defaultCreateEntity(TestEntityGenerateEmpty),
      ),
    ).toEqual("insert");
  });

  test("should resolve update", () => {
    @Entity()
    class TestEntityGenerateExists {
      @PrimaryKeyColumn()
      id!: string;

      @Column()
      @Generated("increment")
      increment!: number;
    }

    expect(
      getSaveStrategy(
        TestEntityGenerateExists,
        defaultCreateEntity(TestEntityGenerateExists, {
          increment: 123,
        }),
      ),
    ).toEqual("update");
  });

  test("should resolve unknown", () => {
    @Entity()
    class TestEntityUnknown {
      @PrimaryKeyColumn()
      id!: string;
    }

    expect(
      getSaveStrategy(TestEntityUnknown, defaultCreateEntity(TestEntityUnknown)),
    ).toEqual("unknown");
  });
});
