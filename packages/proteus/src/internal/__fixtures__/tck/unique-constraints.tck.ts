// TCK: Unique Constraints Suite
// Tests single-field unique, composite unique, partial key overlap, update violation,
// and delete + re-insert scenarios.

import type { TckDriverHandle } from "./types";
import type { TckEntities } from "./create-tck-entities";
import { ProteusRepositoryError } from "../../../errors/ProteusRepositoryError";

export const uniqueConstraintsSuite = (
  getHandle: () => TckDriverHandle,
  entities: TckEntities,
) => {
  describe("Unique Constraints", () => {
    const { TckUniqueConstrained, TckUniqueComposite } = entities;

    beforeEach(async () => {
      await getHandle().clear();
    });

    test("insert rejects duplicate on single-field unique", async () => {
      const repo = getHandle().repository(TckUniqueConstrained);
      await repo.insert({ email: "alice@test.com", name: "Alice" });

      await expect(repo.insert({ email: "alice@test.com", name: "Bob" })).rejects.toThrow(
        ProteusRepositoryError,
      );
    });

    test("insert allows different values on single-field unique", async () => {
      const repo = getHandle().repository(TckUniqueConstrained);
      await repo.insert({ email: "alice@test.com", name: "Alice" });
      const bob = await repo.insert({ email: "bob@test.com", name: "Bob" });

      expect(bob.email).toBe("bob@test.com");
    });

    test("insert rejects duplicate on composite unique", async () => {
      const repo = getHandle().repository(TckUniqueComposite);
      await repo.insert({ tenantId: "t1", key: "k1", value: 100 });

      await expect(
        repo.insert({ tenantId: "t1", key: "k1", value: 200 }),
      ).rejects.toThrow(ProteusRepositoryError);
    });

    test("composite unique allows partial key overlap", async () => {
      const repo = getHandle().repository(TckUniqueComposite);
      await repo.insert({ tenantId: "t1", key: "k1", value: 100 });

      // Same tenantId, different key — should succeed
      const second = await repo.insert({ tenantId: "t1", key: "k2", value: 200 });
      expect(second.tenantId).toBe("t1");
      expect(second.key).toBe("k2");

      // Different tenantId, same key — should succeed
      const third = await repo.insert({ tenantId: "t2", key: "k1", value: 300 });
      expect(third.tenantId).toBe("t2");
      expect(third.key).toBe("k1");
    });

    test("update rejects unique violation", async () => {
      const repo = getHandle().repository(TckUniqueConstrained);
      await repo.insert({ email: "alice@test.com", name: "Alice" });
      const bob = await repo.insert({ email: "bob@test.com", name: "Bob" });

      await expect(repo.update({ ...bob, email: "alice@test.com" })).rejects.toThrow(
        ProteusRepositoryError,
      );
    });

    test("delete + re-insert same unique value succeeds", async () => {
      const repo = getHandle().repository(TckUniqueConstrained);
      const alice = await repo.insert({ email: "alice@test.com", name: "Alice" });

      await repo.destroy(alice);

      const newAlice = await repo.insert({
        email: "alice@test.com",
        name: "Alice Reborn",
      });
      expect(newAlice.email).toBe("alice@test.com");
      expect(newAlice.name).toBe("Alice Reborn");
      expect(newAlice.id).not.toBe(alice.id);
    });
  });
};
