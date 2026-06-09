import { SignatureKit } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import type { PylonCommonContext } from "../../../types/index.js";

export const verifyCookie = async (
  ctx: Pick<PylonCommonContext, "amphora">,
  name: string,
  value: string,
  signature: string | null,
  kid: string | null,
): Promise<void> => {
  if (!signature) {
    throw new ClientError("Cookie signature is missing", {
      code: "missing_cookie_signature",
      title: "Missing Cookie Signature",
      details: "The signed cookie is missing its signature component.",
      type: "urn:lindorm:pylon:error:missing_cookie_signature",
      status: ClientError.Status.Unauthorized,
      data: { name },
      debug: { value, signature, kid },
    });
  }

  if (!kid) {
    throw new ClientError("Cookie key id is missing", {
      code: "missing_cookie_kid",
      title: "Missing Cookie Key ID",
      details: "The signed cookie is missing the key ID needed to verify its signature.",
      type: "urn:lindorm:pylon:error:missing_cookie_kid",
      status: ClientError.Status.Unauthorized,
      data: { name },
      debug: { value, signature, kid },
    });
  }

  try {
    const kryptos = ctx.amphora.findByIdSync(kid);

    if (!new SignatureKit({ kryptos }).verify(value, signature)) {
      throw new ClientError("Cookie signature is invalid", {
        code: "invalid_cookie_signature",
        title: "Invalid Cookie Signature",
        details:
          "The signed cookie's signature could not be verified against the configured keys.",
        type: "urn:lindorm:pylon:error:invalid_cookie_signature",
        status: ClientError.Status.Unauthorized,
        data: { name },
        debug: { value, signature, kid },
      });
    }
  } catch (error) {
    if (error instanceof ClientError) throw error;

    throw new ClientError("Cookie signature is invalid", {
      code: "invalid_cookie_signature",
      title: "Invalid Cookie Signature",
      details:
        "The signed cookie's signature could not be verified against the configured keys.",
      type: "urn:lindorm:pylon:error:invalid_cookie_signature",
      status: ClientError.Status.Unauthorized,
      data: { name },
      debug: {
        value,
        signature,
        kid,
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }
};
