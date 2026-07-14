import { SignatureKit } from "@lindorm/aegis";
import type { PylonCommonContext, PylonSignKey } from "../../../types/index.js";
import { resolveCookieSigningKey } from "../keys/resolve-cookie-signing-key.js";

export const signCookie = async (
  ctx: Pick<PylonCommonContext, "amphora">,
  value: string,
  key: PylonSignKey | undefined,
): Promise<{ signature: string; kid: string }> => {
  // A cookie signature is an INTERNAL artifact — it never leaves this server's
  // own trust boundary, and no relying party verifies it. WHICH key does that is
  // the deployment's call, not pylon's: it names the key in `keys.cookieSignature`
  // and pylon holds only the floor (`use: "sig"`, a private half).
  const kryptos = await resolveCookieSigningKey(ctx.amphora, key);

  const kit = new SignatureKit({ kryptos });

  return {
    signature: kit.format(kit.sign(value)),
    kid: kryptos.id,
  };
};
