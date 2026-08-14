import { isBuffer, isString, isUndefined } from "@lindorm/is";
import type { EncryptData, EncryptOptions, EncryptedToken } from "../../types/index.js";
import { assertWireInput } from "../wire/assert-wire-input.js";
import type { EncryptContentInput } from "../wire/token-wire.js";
import { tokenWireFor } from "../wire/token-wire-for.js";
import type { AegisDeps } from "./aegis-deps.js";
import { applyOmit } from "./apply-omit.js";
import { domainTokenTypePrefix } from "./compute-typ-header.js";
import { domainHeaderToWire } from "./domain-header-to-wire.js";
import { nestedTokenContent } from "./nested-token-content.js";

/**
 * The domain encrypt pipeline (`aegis.encrypt`) — PURE CONFIDENTIALITY, and pure
 * in the `@lindorm/aes` sense: **the value sealed is the value returned**. The
 * payload crosses NO domain↔wire translation in either direction. A `Dict` is
 * serialised under its OWN literal keys, so `{ subject: "x" }` stays `subject`
 * and never becomes `sub`/label 2, and `aegis.decrypt` hands the same object
 * back. Headers and options are still domain-translated — that is aegis's job on
 * every verb — but the payload is the caller's.
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
 * Two options that used to be accepted and dropped now land, and neither needed
 * a path built for it — both fell out of the wire forwarding its kit's whole
 * option surface: `header` reaches the COSE_Encrypt0 writer (RFC 9052 §3 gives
 * the structure a protected bucket and `CweKit.encrypt` always took the bag),
 * and `certificateThumbprintSha1` is now the CALLER's value rather than the
 * deployment default the JWE writer was handed regardless. On the `cwe` path
 * the SHA-1 flag is refused instead: RFC 9360 §2 gives COSE one `x5t` whose
 * digest algorithm is a member of its own value, so there is no legacy
 * thumbprint beside it for a suppression to act on.
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

  // The caller's own value, pruned ONLY when the caller asks for it.
  //
  // ⚠ THE DEFAULT IS THE ASYMMETRY, and it is deliberate: `mint`/`sign` prune
  // empty entries unless told otherwise, this verb prunes nothing unless told
  // to. Pruning shapes a CLAIM SET — it is how an issuer chooses between "the
  // authentication methods are known and none apply" (`amr: []`) and "nothing
  // is stated" (no `amr` at all), a distinction that exists because a claim is
  // an ASSERTION someone signed. This verb has no claims layer to shape: it
  // seals a value and hands that exact value back, so an empty entry is part of
  // the caller's value and dropping it unasked would break the round trip.
  // The knob still works — an explicit mode prunes on both wires — it just
  // never fires unrequested.
  const payload =
    isBuffer(data) || isString(data) || isUndefined(options.omit)
      ? data
      : applyOmit(data, options.omit);

  const input: EncryptContentInput = {
    kryptos,
    deps,
    // The kit's codec serialises the value under its own literal keys and
    // states what it IS, so decrypt reconstructs the same type.
    content: nested?.content ?? payload,
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
    // The CALLER's own request. The deployment default is resolved by the wire
    // that can honour it (`encryptJwe`); passing the resolved value here would
    // make every call look like one that stated something, and the guard below
    // reads caller INTENT.
    certificateThumbprintSha1: options.certificateThumbprintSha1,
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
