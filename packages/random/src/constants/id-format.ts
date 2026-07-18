/**
 * The single source of truth for the lindorm id format. Both the generator
 * (`lindormId`) and the validator (`LINDORM_ID_PATTERN` / `isLindormId`) are built
 * from these constants, so a validator can never drift from the ids it validates.
 */

/** Base62 alphabet every id body is drawn from. */
export const ID_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Bounds of the `LindormIdLength` union (16 | 20 | … | 64). The pattern accepts
 * 16-64 continuously — a deliberate superset of the generator's step-4 union, so
 * an id remains valid if the union ever gains a step.
 */
export const ID_MIN_LENGTH = 16;
export const ID_MAX_LENGTH = 64;

/**
 * Regex character class derived from `ID_ALPHABET` — one body character, and one
 * namespace character (the namespace charset is the same alphanumeric set; a symbol
 * would make `namespace_id` ambiguous to split on the `_`).
 */
export const ID_CHARACTER_CLASS = `[${ID_ALPHABET.replace(/[\\\]^-]/g, "\\$&")}]`;
