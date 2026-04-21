import { randomUUID } from "@lindorm/random";
import type {
  CreateConsumerLoopOptions,
  RedisConsumerLoop,
} from "../types/redis-types.js";
import { parseStreamEntry } from "./parse-stream-entry.js";

export type { CreateConsumerLoopOptions };

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

  const consumerTag = randomUUID();
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

  const loopPromise = (async (): Promise<void> => {
    // Phase 1: Process pending messages (read "0") until none remain
    let readId = "0";

    while (!abortController.signal.aborted) {
      try {
        const results = await connection.xreadgroup(
          "GROUP",
          groupName,
          uniqueConsumerName,
          "COUNT",
          count,
          "BLOCK",
          readId === ">" ? blockMs : 0,
          "STREAMS",
          streamKey,
          readId,
        );

        if (abortController.signal.aborted) break;

        if (!results) {
          if (readId === ">") continue;
          // No pending messages — switch to reading new
          readId = ">";
          resolveReady();
          continue;
        }

        let hasEntries = false;

        for (const [, entries] of results) {
          if (entries.length === 0 && readId === "0") {
            // No more pending messages, switch to new
            readId = ">";
            resolveReady();
            continue;
          }

          hasEntries = entries.length > 0;

          for (const [id, fields] of entries) {
            if (abortController.signal.aborted) break;

            try {
              const entry = parseStreamEntry(id, fields);

              // Race the handler against the abort signal so stuck handlers
              // (e.g. RPC handlers that never respond) don't prevent shutdown.
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
                await Promise.race([onEntry(entry), abortPromise]);
              } finally {
                if (onAbort) {
                  abortController.signal.removeEventListener("abort", onAbort);
                }
              }
              await connection.xack(streamKey, groupName, id);
            } catch (error) {
              if (abortController.signal.aborted) break;

              logger.error(
                "Malformed or unprocessable stream entry — message data lost (ACKed to prevent redelivery)",
                {
                  error: error instanceof Error ? error.message : String(error),
                  streamKey,
                  groupName,
                  entryId: id,
                },
              );
              // Still ACK after error to avoid reprocessing
              try {
                await connection.xack(streamKey, groupName, id);
              } catch {
                // Connection may be closed during abort
              }
            }
          }
        }

        if (!hasEntries && readId === "0") {
          readId = ">";
          resolveReady();
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

    // Ensure ready resolves even if aborted before switching to ">"
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
