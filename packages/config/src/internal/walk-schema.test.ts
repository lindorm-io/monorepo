import { describe, expect, test } from "vitest";
import { z } from "zod";
import { walkSchemaLeaves } from "./walk-schema.js";

const paths = (schema: z.ZodType): Array<Array<string>> =>
  walkSchemaLeaves(schema).map((leaf) => [...leaf.path]);

describe("walkSchemaLeaves", () => {
  test("returns a single empty-path leaf for a primitive", () => {
    expect(paths(z.string())).toEqual([[]]);
  });

  test("walks a flat object", () => {
    expect(paths(z.object({ port: z.number(), host: z.string() }))).toEqual([
      ["port"],
      ["host"],
    ]);
  });

  test("walks nested objects", () => {
    const schema = z.object({
      pylon: z.object({ kek: z.string() }),
      database: z.object({
        postgres: z.object({ url: z.string() }),
        redis: z.object({ url: z.string() }),
      }),
    });

    expect(paths(schema)).toEqual([
      ["pylon", "kek"],
      ["database", "postgres", "url"],
      ["database", "redis", "url"],
    ]);
  });

  test("recurses through optional, nullable, and default wrappers", () => {
    const schema = z.object({
      a: z.object({ x: z.string() }).optional(),
      b: z.object({ y: z.string() }).nullable(),
      c: z.object({ z: z.string() }).default({ z: "" }),
    });

    expect(paths(schema)).toEqual([
      ["a", "x"],
      ["b", "y"],
      ["c", "z"],
    ]);
  });

  test("preserves leaf-level defaults", () => {
    const schema = z.object({
      logger: z.object({
        level: z.enum(["info", "debug"]).default("info"),
      }),
    });

    expect(paths(schema)).toEqual([["logger", "level"]]);
  });

  test("treats arrays, enums, and unions as leaves", () => {
    const schema = z.object({
      hosts: z.array(z.string()),
      mode: z.enum(["a", "b"]),
      either: z.union([z.string(), z.number()]),
    });

    expect(paths(schema)).toEqual([["hosts"], ["mode"], ["either"]]);
  });
});
