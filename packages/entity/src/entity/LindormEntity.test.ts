import Joi from "joi";
import MockDate from "mockdate";
import { LindormEntity } from "./LindormEntity";
import { ILindormEntity, EntityAttributes, EntityOptions } from "../types";
import { JOI_ENTITY_BASE } from "../schema";

MockDate.set("2020-01-01T10:00:00.000Z");

interface TestEntityAttributes extends EntityAttributes {
  name: string;
}

interface TestEntityOptions extends EntityOptions {
  name: string;
}

interface ITestEntity extends ILindormEntity<TestEntityAttributes> {}

const schema = Joi.object({
  ...JOI_ENTITY_BASE,
  name: Joi.string().required(),
});

class TestEntity extends LindormEntity<TestEntityAttributes> implements ITestEntity {
  public readonly name: string;

  constructor(options: TestEntityOptions) {
    super(options);

    this.name = options.name;
  }

  async schemaValidation() {
    return await schema.validateAsync(this.toJSON());
  }

  toJSON() {
    return {
      ...this.defaultJSON(),
      name: this.name,
    };
  }
}

describe("LindormEntity", () => {
  let entity: TestEntity;

  beforeEach(() => {
    entity = new TestEntity({
      id: "e397bc49-849e-4df6-a536-7b9fa3574ace",
      created: new Date("2020-01-01T07:00:00.000Z"),
      name: "name",
      updated: new Date("2020-01-01T09:00:00.000Z"),
      version: 0,
    });
  });

  test("should get id", () => {
    expect(entity.id).toBe("e397bc49-849e-4df6-a536-7b9fa3574ace");
  });

  test("should get created", () => {
    expect(entity.created).toStrictEqual(new Date("2020-01-01T07:00:00.000Z"));
  });

  test("should get/set updated", () => {
    expect(entity.updated).toStrictEqual(new Date("2020-01-01T09:00:00.000Z"));
    entity.updated = new Date("2021-01-01T00:00:01.000Z");
    expect(entity.updated).toStrictEqual(new Date("2021-01-01T00:00:01.000Z"));
  });

  test("should get name", () => {
    expect(entity.name).toBe("name");
  });

  test("should get/set version", () => {
    expect(entity.version).toBe(0);
    entity.version = 99;
    expect(entity.version).toBe(99);
  });

  test("should validate schema", async () => {
    await expect(entity.schemaValidation()).resolves.toMatchSnapshot();
  });

  test("should throw when schema is invalid", async () => {
    const entity = new TestEntity({
      id: "uuid",
      name: "name",
    });
    await expect(entity.schemaValidation()).rejects.toThrow(Joi.ValidationError);
  });

  test("should return to json", () => {
    expect(entity.toJSON()).toMatchSnapshot();
  });
});
