import { IIrisSource } from "@lindorm/iris";
import { ILogger } from "@lindorm/logger";
import { IEntity, IProteusSource } from "@lindorm/proteus";
import { Constructor } from "@lindorm/types";
import { DataAuditChange } from "../../messages";

type AuditAction = "insert" | "update" | "destroy" | "soft_destroy";

const extractEntityId = (entity: any, primaryKeys: Array<string>): string => {
  return primaryKeys.map((key) => String(entity[key] ?? "unknown")).join(":");
};

const computeFieldDiffs = (
  oldEntity: any,
  newEntity: any,
  fields: Array<{ key: string }>,
): Record<string, { from: unknown; to: unknown }> | null => {
  const changes: Record<string, { from: unknown; to: unknown }> = {};

  for (const field of fields) {
    const oldValue = oldEntity[field.key];
    const newValue = newEntity[field.key];

    if (oldValue === newValue) continue;

    // Deep equality check for objects/arrays
    try {
      if (JSON.stringify(oldValue) === JSON.stringify(newValue)) continue;
    } catch {
      // If serialisation fails, treat as changed
    }

    changes[field.key] = { from: oldValue, to: newValue };
  }

  return Object.keys(changes).length > 0 ? changes : null;
};

const publishAuditMessage = (
  iris: IIrisSource,
  logger: ILogger,
  event: {
    entity: any;
    metadata: any;
    context: any;
  },
  action: AuditAction,
  actor: (ctx: any) => string,
  changes: Record<string, { from: unknown; to: unknown }> | null,
): void => {
  try {
    const wq = iris.workerQueue(DataAuditChange);

    const actorValue = event.context ? actor(event.context) : "unknown";
    const correlationId = event.context?.state?.metadata?.correlationId ?? "unknown";
    const entityId = extractEntityId(event.entity, event.metadata.primaryKeys);

    const message = wq.create({
      correlationId,
      actor: actorValue,
      entityName: event.metadata.entity.name,
      entityNamespace: event.metadata.entity.namespace ?? null,
      entityId,
      action,
      changes,
    });

    void wq.publish(message).catch((err) => {
      logger.error("Failed to publish data audit message", err);
    });
  } catch (err: any) {
    logger.error("Failed to create data audit message", err);
  }
};

export const setupDataAuditListeners = (
  proteus: IProteusSource,
  iris: IIrisSource,
  actor: (ctx: any) => string,
  entities: Array<Constructor<IEntity>>,
  logger: ILogger,
): void => {
  const auditedTargets = new Set<Constructor<IEntity>>(entities);

  const isAudited = (metadata: any): boolean => {
    return auditedTargets.has(metadata.target);
  };

  proteus.on("entity:after-insert", (event) => {
    if (!isAudited(event.metadata)) return;
    publishAuditMessage(iris, logger, event, "insert", actor, null);
  });

  proteus.on("entity:after-update", (event) => {
    if (!isAudited(event.metadata)) return;

    let changes: Record<string, { from: unknown; to: unknown }> | null = null;

    if (event.oldEntity) {
      changes = computeFieldDiffs(event.oldEntity, event.entity, event.metadata.fields);
    }

    publishAuditMessage(iris, logger, event, "update", actor, changes);
  });

  proteus.on("entity:after-destroy", (event) => {
    if (!isAudited(event.metadata)) return;
    publishAuditMessage(iris, logger, event, "destroy", actor, null);
  });

  proteus.on("entity:after-soft-destroy", (event) => {
    if (!isAudited(event.metadata)) return;
    publishAuditMessage(iris, logger, event, "soft_destroy", actor, null);
  });

  logger.verbose("Data audit listeners registered", {
    entities: entities.map((e) => e.name),
  });
};
