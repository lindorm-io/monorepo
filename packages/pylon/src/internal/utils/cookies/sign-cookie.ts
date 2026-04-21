import { SignatureKit } from "@lindorm/aegis";
import type { PylonCommonContext } from "../../../types/index.js";

export const signCookie = async (
  ctx: Pick<PylonCommonContext, "amphora">,
  value: string,
): Promise<{ signature: string; kid: string }> => {
  const kryptos = await ctx.amphora.find({
    isExternal: false,
    operations: ["sign"],
    $or: [{ purpose: "cookie" }, { purpose: "session" }, { purpose: undefined }],
    use: "sig",
  });

  const kit = new SignatureKit({ kryptos });

  return {
    signature: kit.format(kit.sign(value)),
    kid: kryptos.id,
  };
};
