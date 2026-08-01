/**
 * OIDC Core §5.1.1 — the `address` claim, plus the lindorm extension.
 *
 * `LindormAddress` marks what lindorm adds beyond the RFC shape;
 * `StandardAddress` is the spec's own member set.
 */

type LindormAddress = {
  /** wire: `care_of` — LINDORM EXTENSION, no RFC counterpart */
  careOf: string | null;
};

type StandardAddress = {
  /** wire: `formatted` — OIDC Core §5.1.1 */
  formatted: string | null;
  /** wire: `country` — OIDC Core §5.1.1 */
  country: string | null;
  /** wire: `locality` — OIDC Core §5.1.1 */
  locality: string | null;
  /** wire: `postal_code` — OIDC Core §5.1.1 */
  postalCode: string | null;
  /** wire: `region` — OIDC Core §5.1.1 */
  region: string | null;
  /** wire: `street_address` — OIDC Core §5.1.1 */
  streetAddress: string | null;
};

export type Address = LindormAddress & StandardAddress;
