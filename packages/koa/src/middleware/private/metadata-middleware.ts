import { ClientError } from "@lindorm-io/errors";
import { randomUUID } from "crypto";
import { DefaultLindormMiddleware } from "../../types";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export const metadataMiddleware: DefaultLindormMiddleware = async (ctx, next): Promise<void> => {
  const correlationId = ctx.get("x-correlation-id")?.toLowerCase() || randomUUID();
  const requestId = ctx.get("x-request-id")?.toLowerCase() || randomUUID();
  const requestDate = ctx.get("date");
  const date = requestDate ? new Date(requestDate) : new Date();

  if (!new RegExp(UUID_V4).test(correlationId)) {
    throw new ClientError("Invalid correlation id format", {
      description: "UUID v4 expected",
    });
  }

  if (!new RegExp(UUID_V4).test(requestId)) {
    throw new ClientError("Invalid request id format", {
      description: "UUID v4 expected",
    });
  }

  if (Date.now() - date.getTime() > 10000) {
    throw new ClientError("Invalid date format", {
      description: "Date must be within 10 seconds of current time",
    });
  }

  ctx.metadata = { date, correlationId, requestId };

  ctx.set("Date", new Date().toUTCString());
  ctx.set("X-Correlation-ID", correlationId);
  ctx.set("X-Request-ID", requestId);

  await next();
};
