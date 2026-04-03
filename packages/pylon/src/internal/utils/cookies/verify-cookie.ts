import { SignatureKit } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import { PylonHttpContext } from "../../../types";

export const verifyCookie = async (
  ctx: PylonHttpContext,
  name: string,
  value: string,
  signature: string | null,
): Promise<void> => {
  if (!signature) {
    throw new ClientError("Missing cookie signature", {
      code: "missing_signature",
      debug: { name, value, signature },
    });
  }

  const array = await ctx.amphora.filter({
    isExternal: false,
    operations: ["verify"],
    use: "sig",
  });

  for (const kryptos of array) {
    if (new SignatureKit({ kryptos }).verify(value, signature)) return;
  }

  throw new ClientError("Invalid cookie signature", {
    code: "invalid_signature",
    debug: { name, value, signature },
  });
};
