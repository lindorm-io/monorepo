import { isString } from "@lindorm/is";
import type { EncryptData, EncryptOptions, EncryptedToken } from "../../types/index.js";
import { assertWireInput } from "../wire/assert-wire-input.js";
import type { EncryptContentInput } from "../wire/token-wire.js";
import { tokenWireFor } from "../wire/token-wire-for.js";
import type { AegisDeps } from "./aegis-deps.js";
import { domainTokenTypePrefix } from "./compute-typ-header.js";
import { domainHeaderToWire } from "./domain-header-to-wire.js";
import { nestedTokenContent } from "./nested-token-content.js";

/**
 * The domain encrypt pipeline (`aegis.encrypt`) — PURE CONFIDENTIALITY: the
 * payload crosses NO domain↔wire translation in either direction. A `Dict` is
 * serialised under its OWN literal keys, so `{ subject: "x" }` stays `subject`
 * and never becomes `sub`/label 2, and `aegis.decrypt` hands the same object
 * back. Headers and options are still domain-translated — that is aegis's job on
 * every verb — but the payload is the caller's.
 *
 * ⚠ NOTHING reaches the payload — not even the claim normalisation every CLAIMS
 * door applies. WHICH DOOR THE CALLER CAME THROUGH is the distinction, not what
 * the payload happens to be made of: `sign` and `mint` attribute claims to an
 * author and normalise them; `encrypt` seals a value and hands that exact value
 * back, so a `Dict` handed to the confidentiality door is opaque even when its
 * keys are spelled like registered claims. The HEADER still normalises — it is
 * aegis's own statement about the token, on every verb.
 *
 * ⚠ It USED to normalise, guarded on the payload's JS TYPE (`isBuffer(data) ||
 * isString(data) ? data : normaliseClaims(data)`), which is the wrong question ON
 * THIS DOOR: it made a `Dict` a claims bag by virtue of being a `Dict`, when the
 * door had already answered that. The identical guard is CORRECT on `sign`, where
 * the door does attribute claims to an author and the JS type is genuinely what
 * decides between bytes and a claims set (`sign-token.ts`). The defence offered
 * was that the registry reaches nothing in a caller-spelled payload — true of the
 * payloads that happen to avoid the vocabulary, and false the moment one does
 * not. `encrypt({ nonce: "" })` lost the member silently, and the caller could
 * not compensate for a prune it never asked for.
 *
 * ⚠ IT USED TO TRANSLATE, and the read side had to undo it: `domainToWire` on the
 * way in, `wireToDomain` on the way out, plus a private claims cty on each wire
 * so the read could tell "a claim set I renamed" from "bytes I did not". Sealing
 * a value verbatim removes all three at once — there is nothing left to
 * discriminate, because nothing was renamed. A claims token with an author is
 * `mint`/`sign`, which is where a claims vocabulary belongs.
 *
 * The ONE thing this verb states about the payload is when it IS a token: an
 * encrypting outer must declare a nested token (RFC 7519 §5.2 makes it a MUST for
 * a nested JWT), so a recognised token is sealed in its wire's native content
 * form under the cty that wire registers for it — the SAME resolution the
 * sign-then-encrypt composition runs, so `aegis.encrypt(signed.token)` and
 * `mint(…, { encrypt })` emit the same declaration. A caller's own `header.cty`
 * still wins.
 *
 * The caller's `header` reaches the COSE_Encrypt0 writer as well as the JWE one
 * — RFC 9052 §3 gives the structure a protected bucket and `CweKit.encrypt`
 * takes the bag — because the wire forwards its kit's whole option surface
 * rather than naming the fields it passes on.
 */
export const encryptToken = async ({
  data,
  options,
  deps,
}: {
  data: EncryptData;
  options: EncryptOptions;
  deps: AegisDeps;
}): Promise<EncryptedToken> => {
  const kryptos = await deps.resolveEncryptKey(options.key);
  const format = options.format ?? "jwe";
  const wire = tokenWireFor(format);

  // A TOKEN is the one payload this verb says something about. Only a string can
  // be one — every aegis surface hands a token back as a string, COSE included
  // (base64url) — so a `Buffer` is bytes and stays bytes.
  const nested = isString(data) ? nestedTokenContent(wire, data) : undefined;

  const input: EncryptContentInput = {
    kryptos,
    deps,
    // The kit's codec serialises the value under its own literal keys and
    // states what it IS, so decrypt reconstructs the same type. The caller's
    // value goes in VERBATIM — see the door rule in the docstring.
    content: nested?.content ?? data,
    tokenType: domainTokenTypePrefix(options.type),
    // The nested-token declaration is a DEFAULT here, written BEFORE the caller's
    // bag so an explicit `header.contentType` displaces it — unlike the
    // sign-then-encrypt composition, where the outer describes a token the
    // composition itself produced and the declaration is its own to make.
    header: domainHeaderToWire(
      nested === undefined
        ? options.header
        : { contentType: nested.cty, ...options.header },
    ),
    bindCertificate: options.bindCertificate,
    partyProducer: options.partyProducer,
    partyRecipient: options.partyRecipient,
    proprietary: options.proprietary,
  };

  assertWireInput(wire.dispositions.encryptContent, input, {
    format,
    operation: "encryptContent",
  });

  return { format, token: wire.encryptContent(input) };
};
