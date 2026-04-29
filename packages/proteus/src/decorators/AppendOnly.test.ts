import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata.js";
import { AppendOnly } from "./AppendOnly.js";
import { Entity } from "./Entity.js";
import { PrimaryKeyField } from "./PrimaryKeyField.js";
import { describe, expect, test } from "vitest";

@AppendOnly()
@Entity({ name: "AppendOnlyDecorated" })
class AppendOnlyDecorated {
  @PrimaryKeyField()
  id!: string;
}

@Entity({ name: "NotAppendOnly" })
class NotAppendOnly {
  @PrimaryKeyField()
  id!: string;
}

describe("AppendOnly", () => {
  test("sets appendOnly to true on entity metadata", () => {
    const meta = getEntityMetadata(AppendOnlyDecorated);
    expect(meta.appendOnly).toBe(true);
  });

  test("appendOnly is false when @AppendOnly is not applied", () => {
    const meta = getEntityMetadata(NotAppendOnly);
    expect(meta.appendOnly).toBe(false);
  });

  test("should match snapshot", () => {
    expect(getEntityMetadata(AppendOnlyDecorated)).toMatchSnapshot();
  });
});
