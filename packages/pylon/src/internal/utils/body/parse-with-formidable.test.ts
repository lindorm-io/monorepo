import type { File, Files } from "formidable";
import { parseWithFormidable } from "./parse-with-formidable.js";
import { beforeEach, describe, expect, test, vi } from "vitest";

const file = (originalFilename: string): File => ({ originalFilename }) as File;

const one = file("one.txt");
const two = file("two.txt");
const three = file("three.txt");

const fields = { note: ["hello"] };

// The map formidable produces when the temp-file flushes complete out of the
// order the parts arrived in — `b` and `c` transposed.
let files: Files = { a: [one], c: [three], b: [two] };
// The order the parser reached the parts, replayed through `fileBegin`.
let begun: Array<[string, File]> = [
  ["a", one],
  ["b", two],
  ["c", three],
];
let error: Error | null = null;

vi.mock("formidable", () => ({
  default: vi.fn().mockImplementation(() => {
    const listeners: Array<(name: string, file: File) => void> = [];
    return {
      on: (event: string, listener: (name: string, file: File) => void) => {
        if (event === "fileBegin") listeners.push(listener);
      },
      parse: (_req: unknown, callback: (e: any, f: any, fs: any) => void) => {
        for (const [name, f] of begun) {
          for (const listener of listeners) listener(name, f);
        }
        callback(error, fields, files);
      },
    };
  }),
}));

const ctx = { req: {}, request: { body: "raw-body" } } as any;

describe("parseWithFormidable", () => {
  beforeEach(() => {
    files = { a: [one], c: [three], b: [two] };
    begun = [
      ["a", one],
      ["b", two],
      ["c", three],
    ];
    error = null;
  });

  test("returns the files in the order the parts arrived, not the order they flushed", async () => {
    const result = await parseWithFormidable(ctx);

    expect(Object.keys(result.files)).toEqual(["a", "b", "c"]);
    expect(
      Object.values(result.files).flatMap((value) =>
        (value ?? []).map((f: File) => f.originalFilename),
      ),
    ).toEqual(["one.txt", "two.txt", "three.txt"]);
  });

  test("returns the parsed fields and the raw body", async () => {
    const result = await parseWithFormidable(ctx);

    expect(result.parsed).toEqual(fields);
    expect(result.raw).toBe("raw-body");
  });

  test("rejects when formidable errors", async () => {
    error = new Error("bad multipart");

    await expect(parseWithFormidable(ctx)).rejects.toThrow("bad multipart");
  });
});
