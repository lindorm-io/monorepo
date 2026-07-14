import { SignatureKit } from "@lindorm/aegis";
import type { PylonCommonContext } from "../../../types/index.js";

export const signCookie = async (
  ctx: Pick<PylonCommonContext, "amphora">,
  value: string,
): Promise<{ signature: string; kid: string }> => {
  // A cookie signature is an INTERNAL artifact — it never leaves this server's
  // own trust boundary, and no relying party verifies it. So the key must be one
  // of our own unpublished cookie/session keys, and explicitly NOT a published
  // token key: amphora's default is `publish: true`, so `publish: false` here is
  // load-bearing, not decoration.
  //
  // `hasPrivateKey` — not `operations: ["sign"]` — is the question that matters:
  // it asks what the key MATERIAL can do rather than what it declares, and it is
  // the same floor aegis signs against.
  const kryptos = await ctx.amphora.find({
    hasPrivateKey: true,
    isExternal: false,
    publish: false,
    purpose: { $in: ["cookie", "session"] },
    use: "sig",
  });

  const kit = new SignatureKit({ kryptos });

  return {
    signature: kit.format(kit.sign(value)),
    kid: kryptos.id,
  };
};
