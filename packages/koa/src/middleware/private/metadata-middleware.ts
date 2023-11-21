import { ClientError } from "@lindorm-io/errors";
import { randomUUID } from "crypto";
import { DefaultLindormMiddleware } from "../../types";

const GUID_REGEX = new RegExp(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
);

export const metadataMiddleware: DefaultLindormMiddleware = async (ctx, next): Promise<void> => {
  const correlationId = ctx.get("x-correlation-id") || randomUUID();
  const requestId = ctx.get("x-request-id") || randomUUID();
  const requestDate = ctx.get("date");
  const date = requestDate ? new Date(requestDate) : new Date();

  if (!GUID_REGEX.test(correlationId)) {
    throw new ClientError("Invalid correlation id format", {
      description: "GUID v4 expected",
    });
  }

  if (!GUID_REGEX.test(requestId)) {
    throw new ClientError("Invalid request id format", {
      description: "GUID v4 expected",
    });
  }

  if (Date.now() - date.getTime() > 10000) {
    throw new ClientError("Invalid date format", {
      description: "Date must be within 10 seconds of current time",
    });
  }

  ctx.metadata = { date, correlationId, requestId };

  await next();

  ctx.set("Date", new Date().toUTCString());
  ctx.set("X-Correlation-ID", correlationId);
  ctx.set("X-Request-ID", requestId);
};
