/**
 * OIDC Core §8 subject identifier types. A CLOSED set — the spec defines
 * exactly these two.
 *
 * NOTE: the deleted `OpenIdSubjectType` in `@lindorm/types` carried
 * `"client" | "identity"`, which is NOT what the spec says. These are the
 * correct values.
 */
export const SubjectType = {
  /** wire: `pairwise` — OIDC Core §8; a different `sub` per sector identifier */
  Pairwise: "pairwise",
  /** wire: `public` — OIDC Core §8; the same `sub` value for every client */
  Public: "public",
} as const;

export type SubjectType = (typeof SubjectType)[keyof typeof SubjectType];
