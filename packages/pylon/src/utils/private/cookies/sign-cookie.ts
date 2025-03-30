import { SignatureKit } from "@lindorm/aegis";
import { PylonHttpContext } from "../../../types";

export const signCookie = async (
  ctx: PylonHttpContext,
  value: string,
): Promise<string> => {
  const kryptos = await ctx.amphora.find({
    isExternal: false,
    operations: ["sign"],
    use: "sig",
  });

  return new SignatureKit({ kryptos }).sign(value);
};
