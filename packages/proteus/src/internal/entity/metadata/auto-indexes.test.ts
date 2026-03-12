import { makeField } from "../../__fixtures__/make-field";
import { generateAutoIndexes } from "./auto-indexes";

describe("generateAutoIndexes", () => {
  test("should return empty array with no special fields", () => {
    const fields = [makeField("name"), makeField("email")];
    expect(generateAutoIndexes("id", fields, [])).toEqual([]);
  });

  test("should generate deleteDate index when DeleteDate present", () => {
    const fields = [
      makeField("deletedAt", {
        decorator: "DeleteDate",
        nullable: true,
        type: "timestamp",
      }),
    ];
    expect(generateAutoIndexes("id", fields, [])).toMatchSnapshot();
  });

  test("should generate version index when Version present", () => {
    const fields = [makeField("version", { decorator: "Version", type: "integer" })];
    expect(generateAutoIndexes("id", fields, [])).toMatchSnapshot();
  });

  test("should generate unique version index when version keys exist", () => {
    const fields = [makeField("version", { decorator: "Version", type: "integer" })];
    expect(generateAutoIndexes("id", fields, ["versionId"])).toMatchSnapshot();
  });

  test("should generate versionStartDate index when VersionStartDate present", () => {
    const fields = [
      makeField("startAt", { decorator: "VersionStartDate", type: "timestamp" }),
    ];
    expect(generateAutoIndexes("id", fields, [])).toMatchSnapshot();
  });

  test("should generate all indexes for deleteDate + expiryDate", () => {
    const fields = [
      makeField("deletedAt", {
        decorator: "DeleteDate",
        nullable: true,
        type: "timestamp",
      }),
      makeField("expiresAt", {
        decorator: "ExpiryDate",
        nullable: true,
        type: "timestamp",
      }),
    ];
    expect(generateAutoIndexes("id", fields, [])).toMatchSnapshot();
  });

  test("should generate all indexes for deleteDate + version", () => {
    const fields = [
      makeField("deletedAt", {
        decorator: "DeleteDate",
        nullable: true,
        type: "timestamp",
      }),
      makeField("version", { decorator: "Version", type: "integer" }),
    ];
    expect(generateAutoIndexes("id", fields, [])).toMatchSnapshot();
  });

  test("should generate all indexes for deleteDate + expiryDate + version", () => {
    const fields = [
      makeField("deletedAt", {
        decorator: "DeleteDate",
        nullable: true,
        type: "timestamp",
      }),
      makeField("expiresAt", {
        decorator: "ExpiryDate",
        nullable: true,
        type: "timestamp",
      }),
      makeField("version", { decorator: "Version", type: "integer" }),
    ];
    expect(generateAutoIndexes("id", fields, [])).toMatchSnapshot();
  });

  test("should generate scope index when Scope present", () => {
    const fields = [makeField("tenantId", { decorator: "Scope" })];
    expect(generateAutoIndexes("id", fields, [])).toMatchSnapshot();
  });

  test("should generate versionStart + versionEnd index when both present", () => {
    const fields = [
      makeField("startAt", { decorator: "VersionStartDate", type: "timestamp" }),
      makeField("endAt", {
        decorator: "VersionEndDate",
        nullable: true,
        type: "timestamp",
      }),
    ];
    expect(generateAutoIndexes("id", fields, [])).toMatchSnapshot();
  });
});
