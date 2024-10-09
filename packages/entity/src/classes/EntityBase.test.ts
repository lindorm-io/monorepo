import MockDate from "mockdate";
import { EntityBase } from "./EntityBase";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

jest.mock("crypto", () => ({
  randomUUID: () => "032eadb7-3889-48fe-b538-5f3baa879182",
}));

describe("EntityBase", () => {
  test("should successfully construct", () => {
    expect(() => new EntityBase()).not.toThrow();
  });

  test("should create with options", () => {
    const entity = new EntityBase({
      id: "09949e11-d00a-53c4-bee9-e7ed8675011f",
      rev: 1,
      seq: 1,
      createdAt: new Date("2024-02-02T10:00:00.000Z"),
      updatedAt: new Date("2024-02-02T10:00:00.000Z"),
      deletedAt: new Date("2024-02-02T10:00:00.000Z"),
      expiresAt: new Date("2024-02-02T10:00:00.000Z"),
    });

    expect(entity.id).toEqual("09949e11-d00a-53c4-bee9-e7ed8675011f");
    expect(entity.rev).toEqual(1);
    expect(entity.seq).toEqual(1);
    expect(entity.createdAt).toEqual(new Date("2024-02-02T10:00:00.000Z"));
    expect(entity.updatedAt).toEqual(new Date("2024-02-02T10:00:00.000Z"));
    expect(entity.deletedAt).toEqual(new Date("2024-02-02T10:00:00.000Z"));
    expect(entity.expiresAt).toEqual(new Date("2024-02-02T10:00:00.000Z"));
  });

  test("should create with default options", () => {
    const entity = new EntityBase();

    expect(entity.id).toEqual("032eadb7-3889-48fe-b538-5f3baa879182");
    expect(entity.rev).toEqual(0);
    expect(entity.seq).toEqual(0);
    expect(entity.createdAt).toEqual(MockedDate);
    expect(entity.updatedAt).toEqual(MockedDate);
    expect(entity.deletedAt).toBeNull();
    expect(entity.expiresAt).toBeNull();
  });
});
