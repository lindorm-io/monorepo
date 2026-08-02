import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ProteusSource } from "../../../classes/ProteusSource.js";
import { ProteusError } from "../../../errors/ProteusError.js";
import {
  Discriminator,
  DiscriminatorValue,
  Entity,
  Field,
  Generated,
  Inheritance,
  Namespace,
  Nullable,
  PrimaryKeyField,
} from "../../../decorators/index.js";
import type { ICacheAdapter } from "../../../interfaces/CacheAdapter.js";

@Entity({ name: "FlushUser" })
class FlushUser {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string")
  name!: string;
}

@Entity({ name: "FlushOrder" })
class FlushOrder {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string")
  reference!: string;
}

// Entity name left to the class name so the naming strategy transforms it —
// proving flushCache prefixes with the TRANSFORMED name, not the class name.
@Entity()
class FlushAuditEntry {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string")
  action!: string;
}

@Entity({ name: "FlushUnregistered" })
class FlushUnregistered {
  @PrimaryKeyField() @Generated("uuid") id!: string;
}

// ─── Single-table hierarchy: every subtype caches under its OWN name ────────

@Inheritance("single-table")
@Discriminator("type")
@Entity({ name: "FlushVehicle" })
class FlushVehicle {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string")
  type!: string;

  @Field("string")
  make!: string;
}

@Entity({ name: "FlushCar" })
@DiscriminatorValue("car")
class FlushCar extends FlushVehicle {
  @Nullable()
  @Field("integer")
  seatCount!: number | null;
}

@Entity({ name: "FlushTruck" })
@DiscriminatorValue("truck")
class FlushTruck extends FlushVehicle {
  @Nullable()
  @Field("float")
  payloadCapacity!: number | null;
}

// ─── Same NAME, two namespaces: two tables that must not share a prefix ─────

@Namespace("billing")
@Entity({ name: "FlushInvoice" })
class FlushBillingInvoice {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string")
  reference!: string;
}

@Namespace("legal")
@Entity({ name: "FlushInvoice" })
class FlushLegalInvoice {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string")
  reference!: string;
}

const ENTITIES = [
  FlushUser,
  FlushOrder,
  FlushAuditEntry,
  FlushVehicle,
  FlushCar,
  FlushTruck,
  FlushBillingInvoice,
  FlushLegalInvoice,
];

const createAdapter = (): ICacheAdapter => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
  delByPrefix: vi.fn().mockResolvedValue(undefined),
});

type SourceOptions = {
  adapter?: ICacheAdapter;
  namespace?: string;
  naming?: "snake";
};

const createSource = async (options: SourceOptions = {}): Promise<ProteusSource> => {
  const source = new ProteusSource({
    driver: "memory",
    entities: ENTITIES,
    namespace: options.namespace,
    naming: options.naming,
    cache: options.adapter ? { adapter: options.adapter, ttl: "1m" } : undefined,
    logger: createMockLogger(),
  });

  await source.connect();
  await source.setup();

  return source;
};

const captureError = async (promise: Promise<void>): Promise<ProteusError> => {
  try {
    await promise;
  } catch (error) {
    return error as ProteusError;
  }
  throw new Error("Expected flushCache to reject, but it resolved");
};

describe("flushCache", () => {
  let adapter: ICacheAdapter;
  let source: ProteusSource;

  beforeEach(() => {
    adapter = createAdapter();
  });

  afterEach(async () => {
    await source?.disconnect();
  });

  describe("single entity", () => {
    test("should flush only the entity's own cache prefix", async () => {
      source = await createSource({ adapter });

      await source.flushCache(FlushUser);

      expect(adapter.delByPrefix).toHaveBeenCalledTimes(1);
      expect(vi.mocked(adapter.delByPrefix).mock.calls).toMatchSnapshot();
    });

    test("should use the naming-strategy-transformed entity name", async () => {
      source = await createSource({ adapter, naming: "snake" });

      await source.flushCache(FlushAuditEntry);

      expect(adapter.delByPrefix).toHaveBeenCalledWith("cache:flush_audit_entry:");
    });

    test("should prefix the namespace when the source has one", async () => {
      source = await createSource({ adapter, namespace: "tenant_a" });

      await source.flushCache(FlushUser);

      expect(adapter.delByPrefix).toHaveBeenCalledWith("tenant_a:cache:FlushUser:");
    });
  });

  describe("array of entities", () => {
    test("should flush one prefix per entity", async () => {
      source = await createSource({ adapter });

      await source.flushCache([FlushUser, FlushOrder]);

      expect(adapter.delByPrefix).toHaveBeenCalledTimes(2);
      expect(vi.mocked(adapter.delByPrefix).mock.calls).toMatchSnapshot();
    });

    test("should not flush the same prefix twice for a duplicated entity", async () => {
      source = await createSource({ adapter });

      await source.flushCache([FlushUser, FlushUser]);

      expect(adapter.delByPrefix).toHaveBeenCalledTimes(1);
      expect(adapter.delByPrefix).toHaveBeenCalledWith("cache:FlushUser:");
    });
  });

  describe("no target", () => {
    test("should flush the whole cache in a SINGLE round-trip", async () => {
      source = await createSource({ adapter });

      await source.flushCache();

      expect(adapter.delByPrefix).toHaveBeenCalledTimes(1);
      expect(adapter.delByPrefix).toHaveBeenCalledWith("cache:");
    });

    test("should flush only the source's namespace when one is configured", async () => {
      source = await createSource({ adapter, namespace: "tenant_a" });

      await source.flushCache();

      expect(adapter.delByPrefix).toHaveBeenCalledTimes(1);
      expect(adapter.delByPrefix).toHaveBeenCalledWith("tenant_a:cache:");
    });
  });

  describe("entity namespace", () => {
    test("should flush distinct prefixes for same-named entities in different namespaces", async () => {
      source = await createSource({ adapter });

      await source.flushCache([FlushBillingInvoice, FlushLegalInvoice]);

      expect(adapter.delByPrefix).toHaveBeenCalledTimes(2);
      expect(vi.mocked(adapter.delByPrefix).mock.calls.flat().sort()).toEqual([
        "cache:billing/FlushInvoice:",
        "cache:legal/FlushInvoice:",
      ]);
    });

    test("should keep the namespaced prefix under the source root so flush-all still matches", async () => {
      source = await createSource({ adapter, namespace: "tenant_a" });

      await source.flushCache(FlushBillingInvoice);

      expect(adapter.delByPrefix).toHaveBeenCalledWith(
        "tenant_a:cache:billing/FlushInvoice:",
      );
      expect(vi.mocked(adapter.delByPrefix).mock.calls[0][0]).toMatch(/^tenant_a:cache:/);
    });
  });

  describe("inheritance", () => {
    test("should flush the whole hierarchy when the ROOT is targeted", async () => {
      source = await createSource({ adapter });

      await source.flushCache(FlushVehicle);

      expect(vi.mocked(adapter.delByPrefix).mock.calls.flat().sort()).toEqual([
        "cache:FlushCar:",
        "cache:FlushTruck:",
        "cache:FlushVehicle:",
      ]);
    });

    test("should flush the root and SIBLING subtypes when a subtype is targeted", async () => {
      source = await createSource({ adapter });

      await source.flushCache(FlushCar);

      expect(vi.mocked(adapter.delByPrefix).mock.calls.flat().sort()).toEqual([
        "cache:FlushCar:",
        "cache:FlushTruck:",
        "cache:FlushVehicle:",
      ]);
    });

    test("should not leak hierarchy expansion into unrelated entities", async () => {
      source = await createSource({ adapter });

      await source.flushCache(FlushUser);

      expect(adapter.delByPrefix).toHaveBeenCalledTimes(1);
    });
  });

  describe("unregistered entity", () => {
    test("should throw entity_not_registered rather than silently no-op", async () => {
      source = await createSource({ adapter });

      const error = await captureError(source.flushCache(FlushUnregistered));

      expect(error).toBeInstanceOf(ProteusError);
      expect({
        code: error.code,
        data: error.data,
        details: error.details,
        message: error.message,
        title: error.title,
        type: error.type,
      }).toMatchSnapshot();
      expect(adapter.delByPrefix).not.toHaveBeenCalled();
    });

    test("should throw before flushing ANY prefix when one entity of an array is unregistered", async () => {
      source = await createSource({ adapter });

      await expect(source.flushCache([FlushUser, FlushUnregistered])).rejects.toThrow(
        /not registered/,
      );
      expect(adapter.delByPrefix).not.toHaveBeenCalled();
    });
  });

  describe("no cache adapter", () => {
    test("should resolve silently so the same code runs without caching", async () => {
      source = await createSource();

      await expect(source.flushCache(FlushUser)).resolves.toBeUndefined();
      await expect(source.flushCache()).resolves.toBeUndefined();
    });

    test("should not throw for an unregistered entity either — nothing is inspected", async () => {
      source = await createSource();

      await expect(source.flushCache(FlushUnregistered)).resolves.toBeUndefined();
    });
  });

  describe("adapter failure", () => {
    test("should throw cache_flush_failed instead of swallowing like implicit invalidation", async () => {
      vi.mocked(adapter.delByPrefix).mockRejectedValue(new Error("redis is down"));
      source = await createSource({ adapter });

      const error = await captureError(source.flushCache(FlushUser));

      expect(error).toBeInstanceOf(ProteusError);
      expect({
        code: error.code,
        data: error.data,
        details: error.details,
        errors: error.errors,
        message: error.message,
        title: error.title,
        type: error.type,
      }).toMatchSnapshot();
    });

    test("should throw when the flush-all round-trip fails", async () => {
      vi.mocked(adapter.delByPrefix).mockRejectedValue(new Error("redis is down"));
      source = await createSource({ adapter });

      await expect(source.flushCache()).rejects.toThrow(
        "Failed to flush the query cache",
      );
    });
  });

  describe("session", () => {
    test("should flush through the SOURCE's adapter and namespace", async () => {
      source = await createSource({ adapter, namespace: "tenant_a" });
      const session = source.session();

      await session.flushCache(FlushUser);

      expect(adapter.delByPrefix).toHaveBeenCalledTimes(1);
      expect(adapter.delByPrefix).toHaveBeenCalledWith("tenant_a:cache:FlushUser:");
    });

    test("should expand the inheritance hierarchy the same way the source does", async () => {
      source = await createSource({ adapter });
      const session = source.session();

      await session.flushCache(FlushTruck);

      expect(vi.mocked(adapter.delByPrefix).mock.calls.flat().sort()).toEqual([
        "cache:FlushCar:",
        "cache:FlushTruck:",
        "cache:FlushVehicle:",
      ]);
    });

    test("should throw entity_not_registered for an entity the source does not know", async () => {
      source = await createSource({ adapter });
      const session = source.session();

      await expect(session.flushCache(FlushUnregistered)).rejects.toThrow(
        /not registered/,
      );
    });
  });
});
