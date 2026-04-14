import { SignatureKit } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import { PylonCommonContext } from "../../../types";

export const verifyCookie = async (
  ctx: Pick<PylonCommonContext, "amphora">,
  name: string,
  value: string,
  signature: string | null,
  kid: string | null,
): Promise<void> => {
  if (!signature) {
    throw new ClientError("Missing cookie signature", {
      code: "missing_signature",
      debug: { name, value, signature, kid },
    });
  }

  if (!kid) {
    throw new ClientError("Missing cookie kid", {
      code: "missing_kid",
      debug: { name, value, signature, kid },
    });
  }

  try {
    const kryptos = ctx.amphora.findByIdSync(kid);

    if (!new SignatureKit({ kryptos }).verify(value, signature)) {
      throw new ClientError("Invalid cookie signature", {
        code: "invalid_signature",
        debug: { name, value, signature, kid },
      });
    }
  } catch (error) {
    if (error instanceof ClientError) throw error;

    throw new ClientError("Invalid cookie signature", {
      code: "invalid_signature",
      debug: {
        name,
        value,
        signature,
        kid,
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }
};
