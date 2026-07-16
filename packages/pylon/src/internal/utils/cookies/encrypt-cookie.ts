import type { AesContent } from "@lindorm/aes";
import type { PylonCommonContext, PylonEncKey } from "../../../types/index.js";
import { resolveCookieEncryptionKey } from "../keys/resolve-cookie-encryption-key.js";

export const encryptCookie = async (
  ctx: Pick<PylonCommonContext, "aegis" | "amphora">,
  value: AesContent,
  key: PylonEncKey | undefined,
): Promise<string> => {
  // A cookie is an INTERNAL, self-opened artifact — the deployment names WHICH
  // key seals it (`keys.cookie.encryption`, or `keys.session.encryption` for the
  // session cookie), and pylon holds only the ENVELOPE floor. Resolving to a
  // CONCRETE key first is what closes the hole: aegis is handed that exact
  // kryptos, so it never reaches its deployment-wide enc policy — which queries
  // the PUBLISHED set and would seal the cookie with the JWKS token key.
  const kryptos = await resolveCookieEncryptionKey(ctx.amphora, key);

  return ctx.aegis.aes.encrypt(value, {
    key: { kryptos, encryption: key?.encryption },
  });
};
