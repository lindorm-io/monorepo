import { isObject } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import type { SignContent } from "../../types/index.js";

/**
 * Merge the FLAT content buckets — `profile` (OIDC standard claims) and
 * `sensitive` (registry `category: "sensitive"`) — into the DOMAIN claim layer,
 * so the translator maps each to its own individual wire claim rather than
 * nesting them under a wrapper. Neither bucket has a wire representation; they
 * are a READ-side categorisation of ordinary registered claims.
 *
 * ⚠ Shared by both encoders: a per-wire merge that folds in one bucket and not
 * the other emits a perfectly valid token with those claims written NOWHERE,
 * while the read side goes on looking for them.
 *
 * Kept OFF the policy-validated `common` layer on purpose: neither bucket
 * carries profile policy, so they join after `enforcePolicy` has run.
 *
 * ⚠ The confidentiality gate is not enforced here. Mint forces encryption when
 * `sensitive` is present and STRIPS the fields when it cannot encrypt them, and
 * the read side surfaces them only from an encrypted token. This step just maps.
 */
export const mergeContentClaims = (common: Dict, content: SignContent): Dict => ({
  ...common,
  ...(isObject(content.profile) ? content.profile : {}),
  ...(isObject(content.sensitive) ? content.sensitive : {}),
});
