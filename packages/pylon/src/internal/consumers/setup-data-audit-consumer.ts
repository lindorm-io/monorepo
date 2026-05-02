import type { IIrisSource } from "@lindorm/iris";
import type { ILogger } from "@lindorm/logger";
import type { IProteusSource } from "@lindorm/proteus";

export const DATA_AUDIT_QUEUE = "pylon.audit.data.persist";

export const setupDataAuditConsumer = async (
  iris: IIrisSource,
  proteus: IProteusSource,
  logger: ILogger,
): Promise<void> => {
  const { DataAuditChange } = await import("../../messages/DataAuditChange.js");
  const { DataAuditLog } = await import("../../entities/DataAuditLog.js");
  const wq = iris.workerQueue(DataAuditChange);

  await wq.consume(DATA_AUDIT_QUEUE, async (message) => {
    const repo = proteus.repository(DataAuditLog);

    await repo.insert({
      correlationId: message.correlationId,
      actor: message.actor,
      entityName: message.entityName,
      entityNamespace: message.entityNamespace,
      entityId: message.entityId,
      action: message.action,
      changes: message.changes,
    });

    logger.debug("Data audit log persisted", {
      entityName: message.entityName,
      entityId: message.entityId,
      action: message.action,
    });
  });

  logger.verbose("Data audit consumer started", { queue: DATA_AUDIT_QUEUE });
};
