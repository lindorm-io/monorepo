import { describe, expect, it } from "vitest";
import type { MessageMetadata, MetaField } from "../types/metadata.js";
import { redactSensitive, redactSensitiveMessage } from "./redact-sensitive.js";

const SECRET = "hunter2-super-secret";

const makeField = (overrides: Partial<MetaField> = {}): MetaField => ({
  key: "testField",
  decorator: "Field",
  default: null,
  enum: null,
  max: null,
  min: null,
  nullable: false,
  optional: false,
  schema: null,
  sensitive: null,
  transform: null,
  type: "string",
  ...overrides,
});

const sensitiveField = (key: string): MetaField =>
  makeField({ key, sensitive: { digest: null } });

const makeMetadata = (fields: Array<MetaField>): Pick<MessageMetadata, "fields"> => ({
  fields,
});

describe("redactSensitive", () => {
  it("should filter a sensitive field value", () => {
    expect(redactSensitive({ sensitive: { digest: null } }, SECRET)).toBe("[Filtered]");
  });

  it("should leave a plain field value", () => {
    expect(redactSensitive({ sensitive: null }, "public")).toBe("public");
  });

  it("should leave the value when the field is unknown", () => {
    expect(redactSensitive(undefined, "public")).toBe("public");
  });
});

describe("redactSensitiveMessage", () => {
  it("should filter a sensitive field and leave the others", () => {
    const metadata = makeMetadata([makeField({ key: "name" }), sensitiveField("apiKey")]);
    const message = { name: "public", apiKey: SECRET };

    const result = redactSensitiveMessage(metadata, message);

    expect(JSON.stringify(result)).not.toContain(SECRET);
    expect(result).toMatchSnapshot();
  });

  it("should filter a @Header property (a header is always a field too)", () => {
    const metadata = makeMetadata([
      makeField({ key: "name" }),
      sensitiveField("authorization"),
    ]);
    const message = { name: "public", authorization: `Bearer ${SECRET}` };

    const result = redactSensitiveMessage(metadata, message);

    expect(JSON.stringify(result)).not.toContain(SECRET);
    expect(result).toMatchSnapshot();
  });

  it("should not mutate the message", () => {
    const metadata = makeMetadata([sensitiveField("apiKey")]);
    const message = { apiKey: SECRET };

    const result = redactSensitiveMessage(metadata, message);

    expect(message.apiKey).toBe(SECRET);
    expect(result).not.toBe(message);
  });

  it("should filter a digest field the same way as a bare sensitive field", () => {
    const metadata = makeMetadata([
      makeField({ key: "passwordHash", sensitive: { digest: "sha256" } }),
    ]);

    expect(redactSensitiveMessage(metadata, { passwordHash: SECRET })).toMatchSnapshot();
  });

  it("should filter every sensitive field on the message", () => {
    const metadata = makeMetadata([
      sensitiveField("apiKey"),
      sensitiveField("password"),
      makeField({ key: "name" }),
    ]);

    expect(
      redactSensitiveMessage(metadata, {
        apiKey: SECRET,
        password: SECRET,
        name: "public",
      }),
    ).toMatchSnapshot();
  });

  it("should return the same object when no field is sensitive", () => {
    const metadata = makeMetadata([makeField({ key: "name" })]);
    const message = { name: "public" };

    expect(redactSensitiveMessage(metadata, message)).toBe(message);
  });

  it("should tolerate a sensitive field that is absent from the message", () => {
    const metadata = makeMetadata([makeField({ key: "name" }), sensitiveField("apiKey")]);

    expect(redactSensitiveMessage(metadata, { name: "public" })).toMatchSnapshot();
  });

  it("should filter a null-valued sensitive field", () => {
    const metadata = makeMetadata([sensitiveField("apiKey")]);

    // null is a value that was explicitly set — it is still replaced, so the
    // shape of the log line never depends on the secret
    expect(redactSensitiveMessage(metadata, { apiKey: null })).toMatchSnapshot();
  });
});
