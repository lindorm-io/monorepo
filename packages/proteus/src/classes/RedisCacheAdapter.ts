import type Redis from "ioredis";
import type { ICacheAdapter } from "../interfaces/CacheAdapter";

/**
 * Options when providing a pre-existing ioredis client.
 * The adapter does NOT own this client and will NOT call quit() on it.
 */
export type RedisCacheAdapterClientOptions = {
  client: Redis;
  keyPrefix?: string;
  scanCount?: number;
};

/**
 * Options when letting the adapter create and own its Redis connection.
 * Provide either `url` or individual connection fields.
 * Call `adapter.disconnect()` (or let ProteusSource.disconnect() handle it) to quit the connection.
 */
export type RedisCacheAdapterConnectionOptions = {
  client?: never;
  url?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  db?: number;
  maxRetriesPerRequest?: number;
  keyPrefix?: string;
  scanCount?: number;
};

/** Options for the Redis-backed cache adapter. Pass either an existing client or connection details. */
export type RedisCacheAdapterOptions =
  | RedisCacheAdapterClientOptions
  | RedisCacheAdapterConnectionOptions;

/**
 * Lua script that atomically scans and unlinks keys matching a pattern.
 *
 * KEYS[1] — the MATCH pattern (e.g. "myapp:cache:User:*")
 * ARGV[1] — the COUNT hint for SCAN
 *
 * Returns the total number of keys removed.
 */
const LUA_DEL_BY_PREFIX = `
local cursor = "0"
local total = 0
repeat
  local result = redis.call("SCAN", cursor, "MATCH", KEYS[1], "COUNT", ARGV[1])
  cursor = result[1]
  local keys = result[2]
  if #keys > 0 then
    for i = 1, #keys, 1000 do
      local batch = {}
      for j = i, math.min(i + 999, #keys) do
        batch[#batch + 1] = keys[j]
      end
      redis.call("UNLINK", unpack(batch))
    end
    total = total + #keys
  end
until cursor == "0"
return total
`;

/**
 * Redis-backed `ICacheAdapter` for query caching.
 *
 * This adapter wraps an existing ioredis client and translates the
 * `ICacheAdapter` contract into Redis GET / SET PX / DEL / SCAN+UNLINK
 * operations. It does **not** own the Redis connection — the caller is
 * responsible for creating the client, handling reconnection, and calling
 * `client.quit()` on shutdown.
 *
 * **Redis Cluster limitation:** The `delByPrefix` method uses a Lua script
 * containing `SCAN`, which only iterates keys on the local node in Cluster
 * mode. For Cluster deployments, prefer `{hash-tag}` key prefixes or a
 * dedicated invalidation strategy.
 *
 * @example — provide an existing client (adapter does not own it)
 * ```ts
 * import Redis from "ioredis";
 * import { RedisCacheAdapter, ProteusSource } from "@lindorm/proteus";
 *
 * const redis = new Redis({ host: "localhost", port: 6379 });
 * const source = new ProteusSource({
 *   cache: { adapter: new RedisCacheAdapter({ client: redis }), ttl: "1m" },
 *   // ...
 * });
 * ```
 *
 * @example — let the adapter create its own connection (adapter owns it, closed via disconnect())
 * ```ts
 * import { RedisCacheAdapter, ProteusSource } from "@lindorm/proteus";
 *
 * const source = new ProteusSource({
 *   cache: {
 *     adapter: new RedisCacheAdapter({ host: "localhost", port: 6379 }),
 *     ttl: "1m",
 *   },
 *   // ...
 * });
 * // ProteusSource.disconnect() automatically calls adapter.disconnect()
 * ```
 */
export class RedisCacheAdapter implements ICacheAdapter {
  private readonly _client: Redis | undefined;
  private readonly _connectionOptions: RedisCacheAdapterConnectionOptions | undefined;
  private _ownedClientPromise: Promise<Redis> | undefined;
  private readonly keyPrefix: string;
  private readonly scanCount: number;

  public constructor(options: RedisCacheAdapterOptions) {
    this.keyPrefix = options.keyPrefix ?? "";
    this.scanCount = options.scanCount ?? 500;

    if (options.client) {
      this._client = options.client;
    } else {
      this._connectionOptions = options;
    }
  }

  private async resolveClient(): Promise<Redis> {
    if (this._client) return this._client;

    if (!this._ownedClientPromise) {
      this._ownedClientPromise = (async () => {
        const { default: Redis } = await import("ioredis");
        const opts = this._connectionOptions!;
        return opts.url
          ? new Redis(opts.url)
          : new Redis({
              host: opts.host,
              port: opts.port,
              username: opts.user,
              password: opts.password,
              db: opts.db,
              maxRetriesPerRequest: opts.maxRetriesPerRequest,
            });
      })().catch((error) => {
        this._ownedClientPromise = undefined;
        throw error;
      });
    }

    return this._ownedClientPromise;
  }

  public get = async (key: string): Promise<string | null> => {
    const client = await this.resolveClient();
    return client.get(this.keyPrefix + key);
  };

  public set = async (key: string, value: string, ttlMs: number): Promise<void> => {
    if (ttlMs < 0) throw new Error(`Invalid ttlMs: ${ttlMs}`);
    if (ttlMs === 0) return;

    const client = await this.resolveClient();
    await client.set(this.keyPrefix + key, value, "PX", ttlMs);
  };

  public del = async (key: string): Promise<void> => {
    const client = await this.resolveClient();
    await client.del(this.keyPrefix + key);
  };

  public delByPrefix = async (prefix: string): Promise<void> => {
    const client = await this.resolveClient();
    await client.eval(
      LUA_DEL_BY_PREFIX,
      1,
      this.keyPrefix + prefix + "*",
      this.scanCount,
    );
  };

  /** Eagerly establish the owned Redis connection. No-op when a client was provided externally. */
  public connect = async (): Promise<void> => {
    if (this._connectionOptions) {
      await this.resolveClient();
    }
  };

  public disconnect = async (): Promise<void> => {
    if (this._ownedClientPromise) {
      const client = await this._ownedClientPromise;
      await client.quit();
    }
  };
}
