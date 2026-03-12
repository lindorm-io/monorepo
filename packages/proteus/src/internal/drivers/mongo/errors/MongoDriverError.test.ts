import { DriverError } from "../../../../errors/DriverError";
import { MongoDriverError } from "./MongoDriverError";
import { MongoMigrationError } from "./MongoMigrationError";

describe("MongoDriverError", () => {
  test("should be an instance of DriverError", () => {
    const error = new MongoDriverError("test error");
    expect(error).toBeInstanceOf(DriverError);
    expect(error).toBeInstanceOf(MongoDriverError);
  });

  test("should carry the error message", () => {
    const error = new MongoDriverError("something went wrong");
    expect(error.message).toBe("something went wrong");
  });

  test("should have correct name", () => {
    const error = new MongoDriverError("test");
    expect(error.name).toMatchSnapshot();
  });
});

describe("MongoMigrationError", () => {
  test("should be an instance of MongoDriverError", () => {
    const error = new MongoMigrationError("migration failed");
    expect(error).toBeInstanceOf(MongoDriverError);
    expect(error).toBeInstanceOf(MongoMigrationError);
  });

  test("should carry the error message", () => {
    const error = new MongoMigrationError("migration failed");
    expect(error.message).toBe("migration failed");
  });
});
