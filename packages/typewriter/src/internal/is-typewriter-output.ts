import { isString } from "@lindorm/is";
import type { TypewriterOutput } from "../types/index.js";

const OUTPUTS: ReadonlyArray<TypewriterOutput> = ["typescript", "typescript-zod"];

/**
 * Membership in the union, not merely stringness. `isString<TypewriterOutput>`
 * proved only the latter, so any `--output` typo narrowed to the union and
 * reached quicktype as an unknown target language.
 */
export const isTypewriterOutput = (input?: unknown): input is TypewriterOutput =>
  isString(input) && OUTPUTS.some((output) => output === input);
