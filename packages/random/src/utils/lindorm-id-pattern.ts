import {
  ID_CHARACTER_CLASS,
  ID_MAX_LENGTH,
  ID_MIN_LENGTH,
} from "../constants/id-format.js";

/**
 * Matches the output of `randomId`: an optional alphanumeric namespace joined with
 * "_", followed by a base62 body of 16-64 characters. Derived from the generator's
 * own alphabet and length bounds — see `constants/id-format.ts`.
 */
export const LINDORM_ID_PATTERN = new RegExp(
  `^(?:${ID_CHARACTER_CLASS}+_)?${ID_CHARACTER_CLASS}{${ID_MIN_LENGTH},${ID_MAX_LENGTH}}$`,
);
