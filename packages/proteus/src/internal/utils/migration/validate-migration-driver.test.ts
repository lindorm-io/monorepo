import { validateMigrationDriver } from "./validate-migration-driver";

const makeMigration = (driver?: string) => ({
  id: "test-id",
  ts: "2024-01-01T00:00:00.000Z",
  driver,
  up: async () => {},
  down: async () => {},
});

describe("validateMigrationDriver", () => {
  it("should not throw when driver is undefined", () => {
    expect(() =>
      validateMigrationDriver(makeMigration(), "test-migration", "postgres"),
    ).not.toThrow();
  });

  it("should not throw when driver matches current driver", () => {
    expect(() =>
      validateMigrationDriver(makeMigration("postgres"), "test-migration", "postgres"),
    ).not.toThrow();
  });

  it("should throw when driver does not match current driver", () => {
    expect(() =>
      validateMigrationDriver(makeMigration("mysql"), "test-migration", "postgres"),
    ).toThrow(
      'Migration "test-migration" was generated for the "mysql" driver but is being run against "postgres"',
    );
  });

  it("should include migration name in error message", () => {
    expect(() =>
      validateMigrationDriver(makeMigration("sqlite"), "20240101-add-users", "mysql"),
    ).toThrow("20240101-add-users");
  });
});
