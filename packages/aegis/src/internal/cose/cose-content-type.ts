import { isString } from "@lindorm/is";
import { COAP_CONTENT_FORMATS } from "./coap-content-formats.js";
import { ownIntEntry } from "./own-entry.js";

/**
 * A COSE `cty` (label 3) as the media type it names: a text string unchanged, a
 * CoAP Content-Format ID as the media type its registry row names
 * ({@link COAP_CONTENT_FORMATS}), anything else `undefined`. RFC 9052 §3.1.
 *
 * ⛔ THE ONE TRANSLATION OF LABEL 3: the codec's read arm
 * (`header/cose-wire-header.ts`) and the keyless sniff behind
 * `isClaimsBearingToken` (`is-cose-format.ts#coseCty`) both call it, so a token
 * cannot declare one content type to a verify and another to the predicate.
 */
export const decodeCoseContentType = (value: unknown): string | undefined =>
  isString(value) ? value : ownIntEntry(COAP_CONTENT_FORMATS, value);
