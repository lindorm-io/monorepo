import { SignatureKit } from "@lindorm/aegis";
import { PylonHttpContext } from "../../../types";

export const signCookie = async (
  ctx: PylonHttpContext,
  value: string,
): Promise<string> => {
  const kryptos = await ctx.amphora.find({
    isExternal: false,
    operations: ["sign"],
    $or: [{ purpose: "cookie" }, { purpose: "session" }, { purpose: undefined }],
    use: "sig",
  });

  const kit = new SignatureKit({ kryptos });

  return kit.format(kit.sign(value));
};
