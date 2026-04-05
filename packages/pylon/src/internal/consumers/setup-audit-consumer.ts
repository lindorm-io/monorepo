import { IIrisSource } from "@lindorm/iris";
import { ILogger } from "@lindorm/logger";
import { IProteusSource } from "@lindorm/proteus";
import { RequestAuditLog } from "../../entities";
import { RequestAudit } from "../../messages";

export const AUDIT_QUEUE = "pylon.audit.request.persist";

export const setupAuditConsumer = async (
  iris: IIrisSource,
  proteus: IProteusSource,
  logger: ILogger,
): Promise<void> => {
  const wq = iris.workerQueue(RequestAudit);

  await wq.consume(AUDIT_QUEUE, async (message) => {
    const repo = proteus.repository(RequestAuditLog);

    await repo.insert({
      requestId: message.requestId,
      correlationId: message.correlationId,
      actor: message.actor,
      appName: message.appName,
      endpoint: message.endpoint,
      method: message.method,
      transport: message.transport,
      statusCode: message.statusCode,
      duration: message.duration,
      sourceIp: message.sourceIp,
      requestBody: message.requestBody,
      sessionId: message.sessionId,
      userAgent: message.userAgent,
    });

    logger.debug("Audit log persisted", { requestId: message.requestId });
  });

  logger.verbose("Audit consumer started", { queue: AUDIT_QUEUE });
};
