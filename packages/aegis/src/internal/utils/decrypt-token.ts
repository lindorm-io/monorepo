import type { Dict } from "@lindorm/types";
import { sanitiseToken } from "@lindorm/utils";
import { AegisError } from "../../errors/index.js";
import { declaredCritToWire } from "../header/declared-crit-to-wire.js";
import type { DecryptOptions, DecryptedToken } from "../../types/index.js";
import { assertWireInput } from "../wire/assert-wire-input.js";
import type { DecryptInput } from "../wire/token-wire.js";
import { tokenWireFor } from "../wire/token-wire-for.js";
import type { AegisDeps } from "./aegis-deps.js";
import { detectTokenFormat } from "./detect-token-format.js";
import { TOKEN_FORMAT_KIND } from "./token-format-kind.js";

/**
 * The domain decrypt pipeline (`aegis.decrypt`) — CONFIDENTIALITY only, with NO
 * signature check (unlike `verify`, which decrypts then REQUIRES a signed inner).
 * The encrypted outer's format is AUTO-DETECTED by the ONE detector every other
 * read verb asks — this verb used to run its own two-step ladder (`isJwe`, then a
 * private "no dot and structurally a COSE_Encrypt0" test) and so could disagree
 * with `verify` and `parse` about what a token IS.
 *
 * From there: the wire resolves the recipient key by the ciphertext's own `kid`,
 * decrypts, and reports the plaintext AS IT WAS SEALED. A non-encrypted token is
 * refused — decrypt is not a general reader (use `verify`/`parse`).
 *
 * ⚠ NO CLAIMS LAYER, and that is the whole verb. It used to run `wireToDomain`
 * over a plaintext the encrypt path had run `domainToWire` over, and report the
 * result split into `claims`/`custom` — so a value came back under names its
 * author never wrote, and each wire needed a private cty to recognise its own
 * writing by. Decryption establishes CONFIDENTIALITY, not authorship: the value
 * returned is the value sealed, and domain claims come from `verify`/`parse`,
 * which have a signature behind them.
 *
 * The ONE header it reports is the same shape `verify` and `parse` report, built
 * by the same translation: the outer's two wire buckets merged under the header
 * registry's `placement` allowlist, protected last. Headers ARE domain-translated
 * — that is aegis's job on every verb; only the payload is left alone.
 */
export const decryptToken = async <C extends Dict = Dict>({
  token,
  options = {},
  deps,
}: {
  token: string;
  options?: DecryptOptions;
  deps: AegisDeps;
}): Promise<DecryptedToken<C>> => {
  const format = detectTokenFormat(token);

  if (format === undefined || TOKEN_FORMAT_KIND[format] !== "encrypted") {
    throw new AegisError("Token is not encrypted", {
      code: "decrypt_requires_encrypted",
      debug: { token: sanitiseToken(token) },
      title: "Decrypt Requires Encrypted Token",
      details:
        "aegis.decrypt reads an encrypted token (a JWE or a COSE_Encrypt0). This token is neither — read a signed token with aegis.verify or aegis.parse.",
    });
  }

  const wire = tokenWireFor(format);

  // The DOMAIN declaration, resolved to the WIRE names the crit gate compares
  // against — `["objectId"]` reaches the kit as `["oid"]`, and a wire spelling at
  // this door is refused (`internal/header/declared-crit-to-wire.ts`).
  const input: DecryptInput = {
    token,
    deps,
    key: options.key,
    crit: declaredCritToWire(options.critical),
  };

  assertWireInput(wire.dispositions.decrypt, input, { format, operation: "decrypt" });

  const read = await wire.decrypt(input);

  return {
    format: wire.encryptedFormat,
    header: read.header,
    contentType: read.header.contentType,
    // The ONE cast: `C` lets a caller NAME the object shape it sealed, and no
    // runtime check can confirm a plaintext matches it — the reconstruction is
    // driven by the outer's cty and answers with whatever that declares.
    payload: read.payload as DecryptedToken<C>["payload"],
    token: read.token,
  };
};
