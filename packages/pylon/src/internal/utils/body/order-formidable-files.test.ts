import type { File, Files } from "formidable";
import { orderFormidableFiles } from "./order-formidable-files.js";
import { describe, expect, test } from "vitest";

const file = (originalFilename: string): File => ({ originalFilename }) as File;

// Flatten exactly the way `handle-upload` does, so the assertions read as the
// order the upload mount persists and responds in.
const flat = (files: Files): Array<string | null> =>
  Object.values(files).flatMap((value) =>
    (value ?? []).map((f: File) => f.originalFilename),
  );

describe("orderFormidableFiles", () => {
  test("rebuilds the field-key order from the fileBegin order", () => {
    const one = file("one.txt");
    const two = file("two.txt");
    const three = file("three.txt");

    // The map formidable hands back when the flushes finished out of order.
    const files: Files = { a: [one], c: [three], b: [two] };

    const result = orderFormidableFiles(files, [one, two, three]);

    expect(Object.keys(result)).toEqual(["a", "b", "c"]);
    expect(flat(result)).toEqual(["one.txt", "two.txt", "three.txt"]);
  });

  test("orders the files within a single field name", () => {
    const one = file("one.txt");
    const two = file("two.txt");
    const three = file("three.txt");

    const result = orderFormidableFiles({ a: [three, one, two] }, [one, two, three]);

    expect(flat(result)).toEqual(["one.txt", "two.txt", "three.txt"]);
  });

  test("keeps interleaved field names grouped, each in wire order", () => {
    const one = file("one.txt");
    const two = file("two.txt");
    const three = file("three.txt");

    // Wire order a=one, b=two, a=three: `a` groups under one key, but `three`
    // must still follow `one`, and `a` must precede `b`.
    const result = orderFormidableFiles({ b: [two], a: [three, one] }, [one, two, three]);

    expect(Object.keys(result)).toEqual(["a", "b"]);
    expect(flat(result)).toEqual(["one.txt", "three.txt", "two.txt"]);
  });

  test("leaves a single-file request untouched", () => {
    const one = file("one.txt");

    expect(orderFormidableFiles({ file: [one] }, [one])).toEqual({ file: [one] });
  });

  test("returns an empty map for an empty map", () => {
    expect(orderFormidableFiles({}, [])).toEqual({});
  });

  test("keeps unranked files, in their original relative order, after ranked ones", () => {
    const one = file("one.txt");
    const two = file("two.txt");
    const three = file("three.txt");

    // Only `three` was seen at fileBegin (a plugin emitting `file` alone leaves
    // the others unranked) — nothing may be dropped.
    const result = orderFormidableFiles({ a: [one, two], b: [three] }, [three]);

    expect(flat(result)).toEqual(["three.txt", "one.txt", "two.txt"]);
  });

  test("does not drop a field holding a bare file instead of an array", () => {
    const one = file("one.txt");
    const two = file("two.txt");

    const result = orderFormidableFiles({ b: two, a: one } as unknown as Files, [
      one,
      two,
    ]);

    expect(flat(result)).toEqual(["one.txt", "two.txt"]);
  });

  test("does not mutate the map it was given", () => {
    const one = file("one.txt");
    const two = file("two.txt");
    const files: Files = { b: [two], a: [one] };

    orderFormidableFiles(files, [one, two]);

    expect(Object.keys(files)).toEqual(["b", "a"]);
  });
});
