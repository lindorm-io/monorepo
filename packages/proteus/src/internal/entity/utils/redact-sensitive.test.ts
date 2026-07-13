import { describe, expect, test } from "vitest";
import { makeField } from "../../__fixtures__/make-field.js";
import type { EntityMetadata } from "../types/metadata.js";
import { redactSensitive, redactSensitiveEntity } from "./redact-sensitive.js";

const SECRET = "hunter2-super-secret";

const sensitiveField = (key: string, embedded?: { parentKey: string }) =>
  makeField(key, {
    sensitive: { digest: null },
    ...(embedded
      ? { embedded: { parentKey: embedded.parentKey, constructor: () => Object } }
      : {}),
  });

type Meta = Pick<EntityMetadata, "fields" | "embeddedLists">;

describe("redactSensitive", () => {
  test("filters a sensitive field value", () => {
    expect(redactSensitive({ sensitive: { digest: null } }, SECRET)).toBe("[Filtered]");
  });

  test("leaves a plain field value", () => {
    expect(redactSensitive({ sensitive: null }, "public")).toBe("public");
  });
});

describe("redactSensitiveEntity", () => {
  test("filters a flat sensitive column", () => {
    const metadata = {
      fields: [makeField("name"), sensitiveField("apiKey")],
      embeddedLists: [],
    } as unknown as Meta;

    expect(
      redactSensitiveEntity(metadata, { name: "public", apiKey: SECRET }),
    ).toMatchSnapshot();
  });

  test("filters a sensitive field inside an @Embedded object", () => {
    const metadata = {
      fields: [
        makeField("name"),
        sensitiveField("credentials.secret", { parentKey: "credentials" }),
      ],
      embeddedLists: [],
    } as unknown as Meta;

    const entity = {
      name: "public",
      credentials: { username: "alice", secret: SECRET },
    };
    const result = redactSensitiveEntity(metadata, entity);

    expect(JSON.stringify(result)).not.toContain(SECRET);
    // the username is not a secret and stays; the source entity is not mutated
    expect(result).toMatchSnapshot();
    expect(entity.credentials.secret).toBe(SECRET);
  });

  test("filters a sensitive element field in an @EmbeddedList", () => {
    const metadata = {
      fields: [makeField("name")],
      embeddedLists: [
        {
          key: "keys",
          elementFields: [makeField("label"), sensitiveField("value")],
        },
      ],
    } as unknown as Meta;

    const entity = {
      name: "public",
      keys: [
        { label: "primary", value: SECRET },
        { label: "backup", value: `${SECRET}-2` },
      ],
    };
    const result = redactSensitiveEntity(metadata, entity);

    expect(JSON.stringify(result)).not.toContain(SECRET);
    expect(result).toMatchSnapshot();
    expect(entity.keys[0].value).toBe(SECRET);
  });

  test("returns the entity untouched when no field is sensitive", () => {
    const metadata = {
      fields: [makeField("name")],
      embeddedLists: [],
    } as unknown as Meta;
    const entity = { name: "public" };

    expect(redactSensitiveEntity(metadata, entity)).toBe(entity);
  });

  test("tolerates a missing embedded parent and a non-array list", () => {
    const metadata = {
      fields: [sensitiveField("credentials.secret", { parentKey: "credentials" })],
      embeddedLists: [{ key: "keys", elementFields: [sensitiveField("value")] }],
    } as unknown as Meta;

    expect(
      redactSensitiveEntity(metadata, { credentials: null, keys: undefined }),
    ).toMatchSnapshot();
  });
});
