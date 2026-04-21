import type { MetaField, MetaHeader } from "../types/metadata";
import { validateHeaders } from "./validate-headers";
import { describe, expect, it } from "vitest";

const makeField = (overrides: Partial<MetaField> & { key: string }): MetaField => ({
  decorator: "Field",
  default: null,
  enum: null,
  max: null,
  min: null,
  nullable: false,
  optional: false,
  schema: null,
  transform: null,
  type: "string",
  ...overrides,
});

describe("validateHeaders", () => {
  it("should pass for valid headers", () => {
    const fields = [makeField({ key: "traceId" }), makeField({ key: "userId" })];
    const headers: Array<MetaHeader> = [
      { key: "traceId", headerName: "x-trace-id" },
      { key: "userId", headerName: "x-user-id" },
    ];

    expect(() => validateHeaders("TestMsg", headers, fields)).not.toThrow();
  });

  it("should throw when header key has no matching field", () => {
    const fields = [makeField({ key: "name" })];
    const headers: Array<MetaHeader> = [{ key: "missing", headerName: "x-missing" }];

    expect(() => validateHeaders("TestMsg", headers, fields)).toThrow(
      '@Header on property "missing" requires a @Field decorator',
    );
  });

  it("should throw when header name uses reserved x-iris- prefix", () => {
    const fields = [makeField({ key: "traceId" })];
    const headers: Array<MetaHeader> = [
      { key: "traceId", headerName: "x-iris-internal" },
    ];

    expect(() => validateHeaders("TestMsg", headers, fields)).toThrow(
      "Header name 'x-iris-internal' uses reserved 'x-iris-' prefix",
    );
  });

  it("should allow headers that do not start with x-iris-", () => {
    const fields = [makeField({ key: "id" })];
    const headers: Array<MetaHeader> = [{ key: "id", headerName: "x-request-id" }];

    expect(() => validateHeaders("TestMsg", headers, fields)).not.toThrow();
  });

  it("should pass with empty headers", () => {
    const fields = [makeField({ key: "name" })];
    const headers: Array<MetaHeader> = [];

    expect(() => validateHeaders("TestMsg", headers, fields)).not.toThrow();
  });

  it("should throw on duplicate header names", () => {
    const fields = [makeField({ key: "traceId" }), makeField({ key: "requestId" })];
    const headers: Array<MetaHeader> = [
      { key: "traceId", headerName: "x-trace-id" },
      { key: "requestId", headerName: "x-trace-id" },
    ];

    expect(() => validateHeaders("TestMsg", headers, fields)).toThrow(
      "Duplicate header name",
    );
  });

  it("should throw on case-insensitive duplicate header names", () => {
    const fields = [makeField({ key: "traceId" }), makeField({ key: "requestId" })];
    const headers: Array<MetaHeader> = [
      { key: "traceId", headerName: "X-Foo" },
      { key: "requestId", headerName: "x-foo" },
    ];

    expect(() => validateHeaders("TestMsg", headers, fields)).toThrow(
      "Duplicate header name",
    );
  });

  it("should throw when @Header is used on an array field", () => {
    const fields = [makeField({ key: "tags", type: "array" })];
    const headers: Array<MetaHeader> = [{ key: "tags", headerName: "x-tags" }];

    expect(() => validateHeaders("TestMsg", headers, fields)).toThrow(
      '@Header cannot be used on array or object fields (field "tags" has type "array")',
    );
  });

  it("should throw when @Header is used on an object field", () => {
    const fields = [makeField({ key: "meta", type: "object" })];
    const headers: Array<MetaHeader> = [{ key: "meta", headerName: "x-meta" }];

    expect(() => validateHeaders("TestMsg", headers, fields)).toThrow(
      '@Header cannot be used on array or object fields (field "meta" has type "object")',
    );
  });

  it("should allow @Header on primitive field types", () => {
    const primitiveTypes = [
      "string",
      "integer",
      "boolean",
      "float",
      "bigint",
      "date",
      "email",
      "enum",
      "url",
      "uuid",
    ] as const;

    for (const type of primitiveTypes) {
      const fields = [makeField({ key: "val", type })];
      const headers: Array<MetaHeader> = [{ key: "val", headerName: "x-val" }];

      expect(() => validateHeaders("TestMsg", headers, fields)).not.toThrow();
    }
  });

  it("should throw on case-insensitive x-iris- prefix", () => {
    const fields = [makeField({ key: "traceId" })];
    const headers: Array<MetaHeader> = [{ key: "traceId", headerName: "X-Iris-Foo" }];

    expect(() => validateHeaders("TestMsg", headers, fields)).toThrow(
      "Header name 'X-Iris-Foo' uses reserved 'x-iris-' prefix",
    );
  });

  it("should throw when @Header is used on a field with @Transform", () => {
    const fields = [
      makeField({
        key: "userId",
        transform: { to: (v: any) => v, from: (v: any) => v },
      }),
    ];
    const headers: Array<MetaHeader> = [{ key: "userId", headerName: "x-user-id" }];

    expect(() => validateHeaders("TestMsg", headers, fields)).toThrow(
      '@Header and @Transform cannot be used on the same field "userId"',
    );
  });

  it("should allow @Header on a field without @Transform", () => {
    const fields = [makeField({ key: "userId", transform: null })];
    const headers: Array<MetaHeader> = [{ key: "userId", headerName: "x-user-id" }];

    expect(() => validateHeaders("TestMsg", headers, fields)).not.toThrow();
  });

  it("should throw on reserved transport header 'content-type'", () => {
    const fields = [makeField({ key: "ct" })];
    const headers: Array<MetaHeader> = [{ key: "ct", headerName: "content-type" }];

    expect(() => validateHeaders("TestMsg", headers, fields)).toThrow(
      "Header name 'content-type' conflicts with reserved transport header",
    );
  });

  it("should throw on reserved transport header 'correlation-id'", () => {
    const fields = [makeField({ key: "cid" })];
    const headers: Array<MetaHeader> = [{ key: "cid", headerName: "correlation-id" }];

    expect(() => validateHeaders("TestMsg", headers, fields)).toThrow(
      "Header name 'correlation-id' conflicts with reserved transport header",
    );
  });

  it("should throw on reserved transport header case-insensitively", () => {
    const fields = [makeField({ key: "rt" })];
    const headers: Array<MetaHeader> = [{ key: "rt", headerName: "Reply-To" }];

    expect(() => validateHeaders("TestMsg", headers, fields)).toThrow(
      "Header name 'Reply-To' conflicts with reserved transport header",
    );
  });

  it("should throw on all reserved transport headers", () => {
    const reserved = [
      "content-type",
      "content-encoding",
      "correlation-id",
      "reply-to",
      "message-id",
      "timestamp",
      "type",
      "delivery-mode",
      "priority",
      "expiration",
    ];

    for (const name of reserved) {
      const fields = [makeField({ key: "f" })];
      const headers: Array<MetaHeader> = [{ key: "f", headerName: name }];

      expect(() => validateHeaders("TestMsg", headers, fields)).toThrow(
        `Header name '${name}' conflicts with reserved transport header`,
      );
    }
  });

  it("should allow non-reserved header names", () => {
    const fields = [makeField({ key: "f" })];
    const headers: Array<MetaHeader> = [{ key: "f", headerName: "x-custom-header" }];

    expect(() => validateHeaders("TestMsg", headers, fields)).not.toThrow();
  });
});
