import { isArray, isObjectLike } from "@lindorm/is";

type ZodShaped = {
  name: "ZodError" | "$ZodError";
  issues: Array<unknown>;
  message?: unknown;
};

// By shape, never instanceof, so every zod copy matches: ZodError is zod 3 / zod 4
// classic, $ZodError is zod 4 core / zod/mini. Pinned: is-zod-shaped.test.ts,
// DataTable.test.ts ("schema error recognition").
export const isZodShaped = (input: unknown): input is ZodShaped =>
  isObjectLike(input) &&
  (input.name === "ZodError" || input.name === "$ZodError") &&
  isArray(input.issues);
