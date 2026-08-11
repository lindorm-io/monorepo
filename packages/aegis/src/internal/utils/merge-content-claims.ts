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
 * Shared by both encoders, and that is the point. It was two merges: the JOSE
 * encoder folded in `profile` and `sensitive`, the COSE encoder only
 * `sensitive` — so `mint(profile, { profile }, { format: "cwt" })` returned a
 * perfectly valid token with those claims written NOWHERE, while COSE verify
 * went on reading a `profile` bucket back. Silent data loss in both directions
 * at once.
 *
 * Kept OFF the policy-validated `common` layer on purpose: neither bucket
 * carries profile policy, so they join after `validateProfileClaims` has run.
 *
 * ⚠ OIDC Core §13.3 is not enforced here. Mint forces encryption when
 * `sensitive` is present and STRIPS the fields when it cannot encrypt them, and
 * the read side surfaces them only from an encrypted token. This step just maps.
 */
export const mergeContentClaims = (common: Dict, content: SignContent): Dict => ({
  ...common,
  ...(isObject(content.profile) ? content.profile : {}),
  ...(isObject(content.sensitive) ? content.sensitive : {}),
});
