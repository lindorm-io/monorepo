import { Tag } from "./cbor.js";
import { COSE_TAG } from "./structures.js";

/**
 * The ONE COSE unwrapper. Every COSE read path starts the same way — strip the
 * optional outer CWT tag (61), reach the structure inside, and check it is an
 * array of the right length — and that opening was written seven times over
 * (`CwsKit`, `CweKit`, `cwt-token`, `cose-encryption`, `cose-encrypt-header`,
 * `is-cose`, `is-cose-format`), each with its own subtly different handling of a
 * bare, untagged structure.
 *
 * {@link unwrapCose} RETURNS a decision and never throws: the structural verdict,
 * and the error naming which structure the caller expected, belong at the call
 * site (a COSE_Sign1 and a COSE_Encrypt0 are malformed in different words).
 */

/** How many elements the COSE structure array must have. */
export type CoseArity = { exactly: number } | { atLeast: number };

/**
 * Strip the optional outer CWT tag (61) to reach the COSE structure it envelopes.
 * aegis wraps every COSE token it emits in that tag; a foreign producer need not,
 * so every read path accepts both.
 */
export const stripCwtTag = (value: unknown): unknown =>
  value instanceof Tag && value.tag === COSE_TAG.cwt ? value.contents : value;

/**
 * The COSE structure Tag a value envelopes — the outer CWT tag (61) stripped
 * first. `undefined` when the value is not a tagged COSE structure (a BARE,
 * untagged array is legal COSE but carries no tag to report).
 */
export const coseStructure = (value: unknown): Tag | undefined => {
  const cose = stripCwtTag(value);

  return cose instanceof Tag ? cose : undefined;
};

/**
 * The COSE structure ARRAY inside a decoded value — `[protected, unprotected,
 * payload, signature]` for a COSE_Sign1/Mac0, `[protected, unprotected,
 * ciphertext]` for a COSE_Encrypt0. The outer CWT tag (61) and the structure's
 * own tag are both stripped; a bare, untagged array passes through, which is
 * what lets aegis read a COSE object another producer did not envelope.
 *
 * `tags`, when given, restricts which structure tags are accepted: a TAGGED
 * structure whose tag is not among them is not the structure the caller asked
 * for, so it reads as absent rather than being unwrapped into the wrong shape.
 *
 * Returns `undefined` for anything that is not an array of the required arity.
 */
export const unwrapCose = (
  value: unknown,
  {
    arity,
    tags,
  }: {
    arity: CoseArity;
    tags?: ReadonlyArray<number>;
  },
): Array<unknown> | undefined => {
  const stripped = stripCwtTag(value);

  if (stripped instanceof Tag && tags && !tags.includes(Number(stripped.tag))) {
    return undefined;
  }

  const contents = stripped instanceof Tag ? stripped.contents : stripped;

  if (!Array.isArray(contents)) return undefined;

  if ("exactly" in arity) {
    return contents.length === arity.exactly ? contents : undefined;
  }

  return contents.length >= arity.atLeast ? contents : undefined;
};
