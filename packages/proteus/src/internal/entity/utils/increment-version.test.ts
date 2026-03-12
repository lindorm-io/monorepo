import { makeField } from "../../__fixtures__/make-field";
import { incrementVersion } from "./increment-version";
import type { EntityMetadata, MetaField } from "../types/metadata";

const makeVersionField = (key = "version"): MetaField<"Version"> =>
  makeField(key, {
    decorator: "Version",
    readonly: true,
    type: "integer",
  }) as MetaField<"Version">;

const makeMetadata = (fields: Array<MetaField> = [makeVersionField()]): EntityMetadata =>
  ({ fields }) as EntityMetadata;

describe("incrementVersion", () => {
  test("should increment version from 1 to 2", () => {
    const entity = { version: 1 } as any;
    incrementVersion(makeMetadata(), entity);
    expect(entity).toMatchSnapshot();
  });

  test("should increment version from 0 to 1", () => {
    const entity = { version: 0 } as any;
    incrementVersion(makeMetadata(), entity);
    expect(entity).toMatchSnapshot();
  });

  test("should throw on negative version", () => {
    const entity = { version: -1 } as any;
    expect(() => incrementVersion(makeMetadata(), entity)).toThrow(
      "Invalid version number: -1",
    );
  });

  test("should throw on NaN version", () => {
    const entity = { version: NaN } as any;
    expect(() => incrementVersion(makeMetadata(), entity)).toThrow(
      "Invalid version number: NaN",
    );
  });

  test("should treat undefined as 0 and set version to 1", () => {
    const entity = { version: undefined } as any;
    incrementVersion(makeMetadata(), entity);
    expect(entity).toMatchSnapshot();
  });

  test("should treat string as 0 and set version to 1", () => {
    const entity = { version: "not-a-number" } as any;
    incrementVersion(makeMetadata(), entity);
    expect(entity).toMatchSnapshot();
  });

  test("should do nothing when metadata has no Version field", () => {
    const entity = { version: 5 } as any;
    incrementVersion(makeMetadata([]), entity);
    expect(entity).toMatchSnapshot();
  });

  test("should use the correct field key from metadata", () => {
    const entity = { rev: 3 } as any;
    incrementVersion(makeMetadata([makeVersionField("rev")]), entity);
    expect(entity).toMatchSnapshot();
  });
});
