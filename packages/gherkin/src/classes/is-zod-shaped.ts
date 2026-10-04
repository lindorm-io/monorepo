import { isArray, isObjectLike } from "@lindorm/is";

type ZodShaped = {
  name: "ZodError" | "$ZodError";
  issues: Array<unknown>;
  message?: unknown;
};

// By shape, never instanceof, so every zod copy matches: ZodError is zod 3 / zod 4
// classic, $ZodError is zod 4 core / zod/mini. Pinned: is-zod-shaped.test.ts,
// DataTable.test.ts ("schema error recognition").
//
// A consumer's schema can throw a value whose `name` or `issues` read throws —
// a getter, a Proxy — and that throw would replace the schema's failure, so an
// unreadable value is not zod-shaped. Pinned: is-zod-shaped.test.ts ("rather
// than throw").
export const isZodShaped = (input: unknown): input is ZodShaped => {
  try {
    return (
      isObjectLike(input) &&
      (input.name === "ZodError" || input.name === "$ZodError") &&
      isArray(input.issues)
    );
  } catch {
    return false;
  }
};
