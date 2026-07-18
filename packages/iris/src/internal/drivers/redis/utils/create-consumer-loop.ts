import { lindormId } from "@lindorm/random";
import { computeDelay } from "@lindorm/retry";
import type {
  CreateConsumerLoopOptions,
  RedisConsumerLoop,
} from "../types/redis-types.js";
import { parseStreamEntry } from "./parse-stream-entry.js";

export type { CreateConsumerLoopOptions };

// How many pending entries to inspect per reclaim pass.
const RECLAIM_BATCH = 100;
// When retries/recovery are in flight, cap the read block so the loop re-checks
// the PEL frequently enough to honor short backoffs (and to catch an entry that
// just failed again and is now backing off anew). Cheap: a couple of XPENDING
// calls per backoff window. When nothing is pending, the loop blocks for the
// full `blockMs` (no polling).
const RECLAIM_POLL_MS = 25;

export const createConsumerLoop = async (
  options: CreateConsumerLoopOptions,
): Promise<RedisConsumerLoop> => {
  const {
    publishConnection,
    streamKey,
    groupName,
    consumerName,
    blockMs,
    count,
    onEntry,
    logger,
    createdGroups,
    startId = "$",
  } = options;

  // Reuse the caller-supplied identity on re-registration (so the new loop
  // reclaims the dead consumer's pending entries); otherwise mint a fresh one.
  const consumerTag = options.consumerTag ?? lindormId({ namespace: "con", length: 16 });
  // Each consumer loop needs a unique name within the group so Redis
  // distributes messages across them (not all to one logical consumer).
  const uniqueConsumerName = `${consumerName}:${consumerTag}`;
  const groupKey = `${streamKey}:${groupName}`;

  // Ensure the consumer group exists
  if (!createdGroups?.has(groupKey)) {
    try {
      await publishConnection.xgroup("CREATE", streamKey, groupName, startId, "MKSTREAM");
      createdGroups?.add(groupKey);
    } catch (err: any) {
      if (String(err?.message).includes("BUSYGROUP")) {
        logger.debug("Consumer group already exists", { streamKey, groupName });
        createdGroups?.add(groupKey);
      } else {
        throw err;
      }
    }
  }

  // Create a dedicated connection for this consumer loop.
  // Disable auto-reconnect: consumer connections are ephemeral. If one dies,
  // the loop exits and the driver's reconnection logic handles re-registration.
  // Without this, disconnect() triggers ioredis reconnect, making shutdown hang.
  const connection = publishConnection.duplicate({ retryStrategy: () => null });
  connection.on("error", (err) => {
    if (abortController.signal.aborted) return; // expected during shutdown
    logger.error("Consumer loop connection error", {
      error: err instanceof Error ? err.message : String(err),
    });
  });

  const abortController = new AbortController();
  let resolveReady!: () => void;
  const ready = new Promise<void>((r) => {
    resolveReady = r;
  });

  // Deliver one entry to the handler, then apply the ack contract (M1 Option B):
  // XACK on "ack"/void; leave it PENDING on "retain" so ONLY this group's
  // reclaim redelivers it. The handler is raced against the abort signal so a
  // stuck handler never blocks shutdown.
  const deliver = async (
    id: string,
    fields: Array<string>,
    attempt: number,
  ): Promise<void> => {
    if (abortController.signal.aborted) return;

    let onAbort: (() => void) | undefined;
    const abortPromise = new Promise<never>((_, reject) => {
      if (abortController.signal.aborted) {
        reject(new Error("Consumer loop aborted"));
        return;
      }
      onAbort = (): void => reject(new Error("Consumer loop aborted"));
      abortController.signal.addEventListener("abort", onAbort, { once: true });
    });

    try {
      const entry = parseStreamEntry(id, fields);
      // Native delivery count drives the attempt (like nats' deliveryCount): the
      // wire `attempt` is vestigial on this driver.
      entry.attempt = attempt;

      const outcome = await Promise.race([onEntry(entry), abortPromise]);

      if (!abortController.signal.aborted && outcome !== "retain") {
        await connection.xack(streamKey, groupName, id);
      }
    } catch (error) {
      if (abortController.signal.aborted) return;

      logger.error(
        "Malformed or unprocessable stream entry — message data lost (ACKed to prevent redelivery)",
        {
          error: error instanceof Error ? error.message : String(error),
          streamKey,
          groupName,
          entryId: id,
        },
      );
      // Still ACK after error to avoid reprocessing a poison entry forever.
      try {
        await connection.xack(streamKey, groupName, id);
      } catch {
        // Connection may be closed during abort
      }
    } finally {
      if (onAbort) {
        abortController.signal.removeEventListener("abort", onAbort);
      }
    }
  };

  // Reclaim this group's retained (failed) / orphaned (crashed-consumer) pending
  // entries whose backoff has elapsed, and redeliver them to THIS consumer only.
  // Returns the block time to use for the next XREADGROUP: `blockMs` when the
  // PEL is empty, else a short poll so short backoffs are honored.
  const reclaimPass = async (): Promise<number> => {
    const pending = await connection.xpending(
      streamKey,
      groupName,
      "-",
      "+",
      RECLAIM_BATCH,
    );

    if (!pending || pending.length === 0) return blockMs;

    let soonest = Infinity;

    for (const row of pending) {
      if (abortController.signal.aborted) break;

      const [id, , idleRaw, deliveriesRaw] = row;
      const idle = Number(idleRaw);
      const deliveries = Number(deliveriesRaw);

      // Read the retry config WITHOUT claiming (XRANGE touches neither the
      // delivery count nor the idle timer).
      const range = await connection.xrange(streamKey, id, id);
      if (!range || range.length === 0) {
        // Entry was trimmed out of the stream (MAXLEN) but lingers in the PEL —
        // ACK it so it does not pend forever.
        try {
          await connection.xack(streamKey, groupName, id);
        } catch {
          // best-effort
        }
        continue;
      }

      const entry = parseStreamEntry(id, range[0][1]);
      const required = Math.max(
        0,
        Math.round(
          computeDelay(deliveries, {
            strategy: entry.retryStrategy,
            delay: entry.retryDelay,
            delayMax: entry.retryDelayMax,
            multiplier: entry.retryMultiplier,
            jitter: entry.retryJitter,
          }),
        ),
      );

      if (idle < required) {
        soonest = Math.min(soonest, required - idle);
        continue;
      }

      // Claim to this consumer. min-idle-time = required makes the claim atomic
      // across sibling loops in the same group (a competing consumer that just
      // reclaimed reset idle to 0, so our XCLAIM matches nothing and we skip).
      // The reclaimed entry is redelivered to THIS group only — a retry stays
      // targeted to the consumer that failed, never fanning back out.
      const claimed = await connection.xclaim(
        streamKey,
        groupName,
        uniqueConsumerName,
        required,
        id,
      );

      if (!claimed || claimed.length === 0) continue;

      // XCLAIM bumped the delivery count to `deliveries + 1`; the zero-based
      // attempt for THIS delivery is `deliveries` (delivery N -> attempt N-1).
      await deliver(claimed[0][0], claimed[0][1], deliveries);
    }

    // Something is in flight — poll soon (bounded by the nearest due backoff) so
    // an entry that just failed again is picked up promptly.
    return Math.max(1, Math.min(soonest, RECLAIM_POLL_MS));
  };

  const loopPromise = (async (): Promise<void> => {
    let readySignalled = false;

    while (!abortController.signal.aborted) {
      try {
        const nextBlock = await reclaimPass();

        if (abortController.signal.aborted) break;

        if (!readySignalled) {
          resolveReady();
          readySignalled = true;
        }

        // Read NEW (never-delivered) entries. A ">" read is always a first
        // delivery, so attempt 0; retries/recoveries arrive via reclaimPass.
        const results = await connection.xreadgroup(
          "GROUP",
          groupName,
          uniqueConsumerName,
          "COUNT",
          count,
          "BLOCK",
          nextBlock,
          "STREAMS",
          streamKey,
          ">",
        );

        if (abortController.signal.aborted) break;
        if (!results) continue;

        for (const [, entries] of results) {
          for (const [id, fields] of entries) {
            if (abortController.signal.aborted) break;
            await deliver(id, fields, 0);
          }
        }
      } catch (error) {
        if (abortController.signal.aborted) break;

        logger.error("Consumer loop read error", {
          error: error instanceof Error ? error.message : String(error),
          streamKey,
          groupName,
        });

        // Brief delay before retrying on error
        await new Promise<void>((resolve) => {
          const t = setTimeout(resolve, 1000);
          t.unref();
        });
      }
    }

    // Ensure ready resolves even if aborted before the first read.
    resolveReady();

    // Close the dedicated connection when loop ends.
    // Use disconnect() (immediate socket close) rather than quit() (sends QUIT
    // command and awaits response). When the loop is aborted, stopConsumerLoop
    // already called disconnect(), putting ioredis in "end" state — quit() on
    // an ended connection hangs indefinitely.
    try {
      void connection.disconnect();
    } catch {
      // Already closed
    }
  })();

  const loop: RedisConsumerLoop = {
    consumerTag,
    groupName,
    streamKey,
    callback: onEntry,
    abortController,
    loopPromise,
    connection,
    ready,
  };

  return loop;
};
