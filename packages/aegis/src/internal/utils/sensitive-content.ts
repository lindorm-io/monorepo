import { isObject } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { omitUndefined } from "@lindorm/utils";
import type { SignContent } from "../../types/index.js";
import { SENSITIVE_DOMAINS } from "./extract-sensitive-claims.js";

/**
 * The content containers whose contents actually reach the wire as claims. The
 * top level is NOT one of them: `assembleCommonClaims` picks only
 * `sensitivity: "public"` claims from it, so a sensitive value written there is
 * dropped before it can be emitted.
 */
const CARRIERS = ["claims", "profile", "sensitive"] as const;

const carrierOf = (content: SignContent, key: (typeof CARRIERS)[number]): Dict =>
  isObject((content as Dict)[key]) ? ((content as Dict)[key] as Dict) : {};

/**
 * The sensitive claims this mint would actually put on the wire, by DOMAIN name.
 *
 * ⚠ A claim is sensitive because of WHAT IT IS, not because of which container
 * the caller happened to put it in. The confidentiality decision therefore reads
 * the claim registry, so no input shape can route a sensitive value around it —
 * a national identity number placed in the general `claims` bag is exactly as
 * disclosed as one placed in the `sensitive` bag, and three of the encryptable
 * profiles do not even admit the latter.
 */
export const findSensitiveClaims = (content: SignContent): Array<string> => {
  const found = new Set<string>();

  for (const carrier of CARRIERS) {
    const values = carrierOf(content, carrier);
    for (const domain of SENSITIVE_DOMAINS) {
      if (values[domain] !== undefined) found.add(domain);
    }
  }

  return [...found];
};

/**
 * Remove the named sensitive claims from every container that carries one.
 *
 * A sensitive claim MUST NOT travel in cleartext: when it cannot be encrypted —
 * the profile is not encryptable, or no recipient key is resolvable — it is
 * omitted from the token entirely rather than signed in the clear.
 */
export const stripSensitiveClaims = (
  content: SignContent,
  claims: ReadonlyArray<string>,
): SignContent => {
  const stripped: Dict = { ...(content as Dict) };

  for (const carrier of CARRIERS) {
    const values = carrierOf(content, carrier);
    if (Object.keys(values).length === 0) continue;

    const kept: Dict = { ...values };
    for (const claim of claims) delete kept[claim];

    stripped[carrier] = Object.keys(kept).length > 0 ? kept : undefined;
  }

  return omitUndefined(stripped) as SignContent;
};
