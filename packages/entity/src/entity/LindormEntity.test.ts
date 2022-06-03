import Joi from "joi";
import MockDate from "mockdate";
import { TestEntity } from "../mocks";

MockDate.set("2020-01-01T10:00:00.000Z");

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
