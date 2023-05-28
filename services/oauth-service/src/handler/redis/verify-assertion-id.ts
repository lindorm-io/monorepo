import { ClientError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../../types";

export const verifyAssertionId = async (
  ctx: ServerKoaContext,
  assertionId?: string,
): Promise<void> => {
  const {
    connection: {
      redis: { client },
    },
    logger,
  } = ctx;

  if (!assertionId) {
    return;
  }

  const key = `lindorm_io_oauth_service_assertion_id:${assertionId}`;

  logger.debug("Verifying assertion id", { key, assertionId });

  const stored = await client.get(key);

  if (stored) {
    throw new ClientError("Assertion ID has already been used", {
      statusCode: ClientError.StatusCode.FORBIDDEN,
    });
  }

  logger.debug("Storing new assertion id", { assertionId });

  await client.setex(key, 3600, 1);
};
