import type { Redis } from "ioredis";
import type { IEntity } from "../../../../interfaces";
import type { MetaRelation } from "../../../entity/types/metadata";
import type { JoinTableOps } from "../../../types/join-table-ops";
import { getJoinName } from "../../../entity/utils/get-join-name";
import { getEntityMetadata } from "../../../entity/metadata/get-entity-metadata";
import { buildJoinSetKey, buildReverseJoinSetKey } from "./build-join-set-key";
import { encodePkSegment } from "./encode-pk-segment";
import { scanEntityKeys } from "./scan-entity-keys";
import { RedisDriverError } from "../errors/RedisDriverError";

/**
 * Build a SCAN MATCH pattern for all reverse join SET keys of a given join table.
 *
 * Pattern: `{ns}:{join}:{joinTable}:rev:*` or `{join}:{joinTable}:rev:*`
 */
const buildReverseJoinScanPattern = (
  joinTableName: string,
  namespace: string | null,
): string => {
  const scoped = getJoinName(joinTableName, { namespace });
  const segments = scoped.parts.map(encodePkSegment);
  segments.push("rev");
  segments.push("*");
  return segments.join(":");
};

/**
 * Build a SCAN MATCH pattern for all forward join SET keys of a given join table.
 *
 * Pattern: `{ns}:{join}:{joinTable}:*` or `{join}:{joinTable}:*`
 */
const buildForwardJoinScanPattern = (
  joinTableName: string,
  namespace: string | null,
): string => {
  const scoped = getJoinName(joinTableName, { namespace });
  const segments = scoped.parts.map(encodePkSegment);
  segments.push("*");
  return segments.join(":");
};

/**
 * Create bidirectional Redis SET-based join table operations for M2M relations.
 *
 * Forward SET key: `{ns}:{join}:{joinTable}:{ownerJoinCol}:{ownerPkValue}`
 *   Contains: target PK values as SET members.
 *
 * Reverse SET key: `{ns}:{join}:{joinTable}:rev:{targetJoinCol}:{targetPkValue}`
 *   Contains: owner PK values as SET members.
 *
 * Both directions are maintained on sync/delete for efficient bidirectional loading.
 */
export const createRedisJoinTableOps = (
  client: Redis,
  namespace: string | null,
): JoinTableOps => ({
  sync: async (
    entity: IEntity,
    relatedEntities: Array<IEntity>,
    relation: MetaRelation,
    mirror: MetaRelation,
    _namespace: string | null,
  ): Promise<void> => {
    const ownerFindKeys = Object.entries(relation.findKeys ?? {});
    const targetFindKeys = Object.entries(mirror.findKeys ?? {});

    if (ownerFindKeys.length === 0 || targetFindKeys.length === 0) return;

    const joinTableName = relation.joinTable as string;

    // Use the first join column pair for the SET key pattern
    const [ownerJoinCol, ownerEntityKey] = ownerFindKeys[0];
    const [targetJoinCol, targetEntityKey] = targetFindKeys[0];

    const ownerPkValue = (entity as any)[ownerEntityKey];
    const forwardKey = buildJoinSetKey(
      joinTableName,
      ownerJoinCol,
      ownerPkValue,
      namespace,
    );

    // Get existing target PKs from forward SET
    const existingMembers = await client.smembers(forwardKey);
    const existingSet = new Set(existingMembers);

    // Build desired target PK set
    const desiredSet = new Set<string>();
    for (const related of relatedEntities) {
      desiredSet.add(String((related as any)[targetEntityKey]));
    }

    // Compute diff
    const toAdd: Array<string> = [];
    const toRemove: Array<string> = [];

    for (const member of desiredSet) {
      if (!existingSet.has(member)) {
        toAdd.push(member);
      }
    }

    for (const member of existingSet) {
      if (!desiredSet.has(member)) {
        toRemove.push(member);
      }
    }

    if (toAdd.length === 0 && toRemove.length === 0) return;

    const pipeline = client.pipeline();
    const ownerPkStr = String(ownerPkValue);

    // Forward SET: add new members, remove old ones
    if (toAdd.length > 0) {
      pipeline.sadd(forwardKey, ...toAdd);
    }
    if (toRemove.length > 0) {
      pipeline.srem(forwardKey, ...toRemove);
    }

    // Reverse SETs: add owner to new targets' reverse SETs, remove from old
    for (const targetPk of toAdd) {
      const reverseKey = buildReverseJoinSetKey(
        joinTableName,
        targetJoinCol,
        targetPk,
        namespace,
      );
      pipeline.sadd(reverseKey, ownerPkStr);
    }

    for (const targetPk of toRemove) {
      const reverseKey = buildReverseJoinSetKey(
        joinTableName,
        targetJoinCol,
        targetPk,
        namespace,
      );
      pipeline.srem(reverseKey, ownerPkStr);
    }

    const syncResult = await pipeline.exec();
    if (!syncResult) {
      throw new RedisDriverError("Pipeline execution failed — returned null");
    }
  },

  delete: async (
    entity: IEntity,
    relation: MetaRelation,
    _namespace: string | null,
  ): Promise<void> => {
    const ownerFindKeys = Object.entries(relation.findKeys ?? {});
    if (ownerFindKeys.length === 0) return;

    const joinTableName = relation.joinTable as string;
    const [ownerJoinCol, ownerEntityKey] = ownerFindKeys[0];
    const ownerPkValue = (entity as any)[ownerEntityKey];

    const forwardKey = buildJoinSetKey(
      joinTableName,
      ownerJoinCol,
      ownerPkValue,
      namespace,
    );

    // Get all target PKs from forward SET
    const targetMembers = await client.smembers(forwardKey);
    const ownerPkStr = String(ownerPkValue);

    const pipeline = client.pipeline();

    if (targetMembers.length > 0) {
      // Resolve the mirror relation to determine the target join column name,
      // then build exact reverse keys instead of SCANning all reverse keys.
      const foreignMeta = getEntityMetadata(relation.foreignConstructor());
      const mirror = foreignMeta.relations.find((r) => r.key === relation.foreignKey);
      const targetFindKeys = Object.entries(mirror?.findKeys ?? {});

      if (targetFindKeys.length > 0) {
        const [targetJoinCol] = targetFindKeys[0];

        for (const targetMember of targetMembers) {
          const reverseKey = buildReverseJoinSetKey(
            joinTableName,
            targetJoinCol,
            targetMember,
            namespace,
          );
          pipeline.srem(reverseKey, ownerPkStr);
        }
      } else {
        // Fallback: SCAN for reverse keys if mirror findKeys are unavailable
        const reversePattern = buildReverseJoinScanPattern(joinTableName, namespace);
        const reverseKeys = await scanEntityKeys(client, reversePattern);

        for (const rk of reverseKeys) {
          pipeline.srem(rk, ownerPkStr);
        }
      }
    }

    // Delete the forward SET key
    pipeline.del(forwardKey);

    const deleteResult = await pipeline.exec();
    if (!deleteResult) {
      throw new RedisDriverError("Pipeline execution failed — returned null");
    }
  },
});

/**
 * Exported for use by RedisRepository.clear() to SCAN+DEL all join SET keys.
 */
export { buildForwardJoinScanPattern, buildReverseJoinScanPattern };
