import type { EntityMetadata } from "../../entity/types/metadata.js";
import { validatePaginateOptions } from "./validate-paginate-options.js";
import { describe, expect, it } from "vitest";

const createMockMetadata = (fieldKeys: Array<string>): EntityMetadata =>
  ({
    fields: fieldKeys.map((key) => ({ key })),
  }) as unknown as EntityMetadata;

describe("validatePaginateOptions", () => {
  it("should accept valid forward pagination", () => {
    expect(() =>
      validatePaginateOptions({
        first: 10,
        orderBy: { createdAt: "ASC" },
      }),
    ).not.toThrow();
  });

  it("should accept valid forward pagination with after cursor", () => {
    expect(() =>
      validatePaginateOptions({
        first: 10,
        after: "some-cursor",
        orderBy: { createdAt: "ASC" },
      }),
    ).not.toThrow();
  });

  it("should accept valid backward pagination", () => {
    expect(() =>
      validatePaginateOptions({
        last: 10,
        orderBy: { createdAt: "ASC" },
      }),
    ).not.toThrow();
  });

  it("should accept valid backward pagination with before cursor", () => {
    expect(() =>
      validatePaginateOptions({
        last: 10,
        before: "some-cursor",
        orderBy: { createdAt: "ASC" },
      }),
    ).not.toThrow();
  });

  it("should reject when neither first nor last is provided", () => {
    expect(() =>
      validatePaginateOptions({
        orderBy: { createdAt: "ASC" },
      }),
    ).toThrow("requires either `first` or `last`");
  });

  it("should reject when both first and last are provided", () => {
    expect(() =>
      validatePaginateOptions({
        first: 10,
        last: 10,
        orderBy: { createdAt: "ASC" },
      }),
    ).toThrow("does not support both `first` and `last`");
  });

  it("should reject non-positive first", () => {
    expect(() =>
      validatePaginateOptions({
        first: 0,
        orderBy: { createdAt: "ASC" },
      }),
    ).toThrow("`first` must be a positive integer");
  });

  it("should reject negative first", () => {
    expect(() =>
      validatePaginateOptions({
        first: -5,
        orderBy: { createdAt: "ASC" },
      }),
    ).toThrow("`first` must be a positive integer");
  });

  it("should reject non-integer first", () => {
    expect(() =>
      validatePaginateOptions({
        first: 2.5,
        orderBy: { createdAt: "ASC" },
      }),
    ).toThrow("`first` must be a positive integer");
  });

  it("should reject before cursor with first", () => {
    expect(() =>
      validatePaginateOptions({
        first: 10,
        before: "cursor",
        orderBy: { createdAt: "ASC" },
      }),
    ).toThrow("`before` cursor is only valid with `last`");
  });

  it("should reject after cursor with last", () => {
    expect(() =>
      validatePaginateOptions({
        last: 10,
        after: "cursor",
        orderBy: { createdAt: "ASC" },
      }),
    ).toThrow("`after` cursor is only valid with `first`");
  });

  it("should reject non-positive last", () => {
    expect(() =>
      validatePaginateOptions({
        last: 0,
        orderBy: { createdAt: "ASC" },
      }),
    ).toThrow("`last` must be a positive integer");
  });

  it("should reject empty orderBy", () => {
    expect(() =>
      validatePaginateOptions({
        first: 10,
        orderBy: {},
      }),
    ).toThrow("requires at least one entry in `orderBy`");
  });

  it("should accept valid orderBy fields when metadata is provided", () => {
    const metadata = createMockMetadata(["createdAt", "name", "id"]);
    expect(() =>
      validatePaginateOptions(
        { first: 10, orderBy: { createdAt: "ASC", name: "DESC" } },
        metadata,
      ),
    ).not.toThrow();
  });

  it("should reject unknown orderBy fields when metadata is provided", () => {
    const metadata = createMockMetadata(["createdAt", "id"]);
    expect(() =>
      validatePaginateOptions(
        { first: 10, orderBy: { createdAt: "ASC", nonExistent: "DESC" } },
        metadata,
      ),
    ).toThrow('Unknown field "nonExistent" in paginate orderBy');
  });

  it("should skip field validation when metadata is not provided", () => {
    expect(() =>
      validatePaginateOptions({
        first: 10,
        orderBy: { anythingGoes: "ASC" },
      }),
    ).not.toThrow();
  });
});
