// Per-source programmatic decorator staging (source.stageFieldDecorator /
// source.stageDecorator). The whole point of doing this PER SOURCE — rather than
// mutating the shared Entity[Symbol.metadata] — is multi-source safety: two
// sources staging different selectors on the SAME entity must not leak into each
// other, and the shared base metadata must stay untouched.

import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { afterEach, describe, expect, test } from "vitest";
import { Encrypted } from "../decorators/Encrypted.js";
import { Entity } from "../decorators/Entity.js";
import { Field } from "../decorators/Field.js";
import { Generated } from "../decorators/Generated.js";
import { PrimaryKeyField } from "../decorators/PrimaryKeyField.js";
import { ProteusError } from "../errors/ProteusError.js";
import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata.js";
import { ProteusSource } from "./ProteusSource.js";

// A dummy decorator factory neither method knows how to stage.
const Unsupported = () => () => {};

// Capture a thrown error for code assertions (vitest's toThrow matches
// message/class, not the error's `code`).
const getThrown = (fn: () => void): unknown => {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error("expected function to throw, but it did not");
};

const newSource = (entities: Array<Function>): ProteusSource =>
  new ProteusSource({
    driver: "sqlite",
    filename: ":memory:",
    entities: entities as never,
    logger: createMockLogger(),
    synchronize: true,
  });

const metadataFor = (source: ProteusSource, target: Function) =>
  source.getEntityMetadata().find((m) => m.target === (target as never))!;

let sources: Array<ProteusSource> = [];

const track = (source: ProteusSource): ProteusSource => {
  sources.push(source);
  return source;
};

afterEach(async () => {
  await Promise.all(sources.map((s) => s.disconnect()));
  sources = [];
});

describe("ProteusSource staging", () => {
  describe("stageFieldDecorator — Encrypted", () => {
    test("overrides a bare @Encrypted selector on this source only", () => {
      @Entity({ name: "staging_override" })
      class StagingOverride {
        @PrimaryKeyField() @Generated("uuid") id!: string;

        // Ships as a BARE marker — the consumer supplies the key selector.
        @Encrypted()
        @Field("string")
        secret!: string;
      }

      const source = track(newSource([StagingOverride]));

      source.stageFieldDecorator(StagingOverride, "secret", Encrypted, {
        condition: { purpose: "x" },
      });

      const field = metadataFor(source, StagingOverride).fields.find(
        (f) => f.key === "secret",
      )!;

      expect(field.encrypted).toEqual({ kryptos: null, condition: { purpose: "x" } });
    });

    test("staged selector outranks the source-level encryption default", () => {
      @Entity({ name: "staging_precedence" })
      class StagingPrecedence {
        @PrimaryKeyField() @Generated("uuid") id!: string;

        @Encrypted()
        @Field("string")
        secret!: string;
      }

      const source = track(
        new ProteusSource({
          driver: "sqlite",
          filename: ":memory:",
          entities: [StagingPrecedence] as never,
          logger: createMockLogger(),
          synchronize: true,
          encryption: { condition: { purpose: "source-default" } },
        }),
      );

      source.stageFieldDecorator(StagingPrecedence, "secret", Encrypted, {
        condition: { purpose: "staged" },
      });

      const field = metadataFor(source, StagingPrecedence).fields.find(
        (f) => f.key === "secret",
      )!;

      // staged > source `encryption` default.
      expect(field.encrypted).toEqual({
        kryptos: null,
        condition: { purpose: "staged" },
      });
    });

    test("re-staging the same field replaces the previous selector", () => {
      @Entity({ name: "staging_replace" })
      class StagingReplace {
        @PrimaryKeyField() @Generated("uuid") id!: string;

        @Encrypted()
        @Field("string")
        secret!: string;
      }

      const source = track(newSource([StagingReplace]));

      source.stageFieldDecorator(StagingReplace, "secret", Encrypted, {
        condition: { purpose: "first" },
      });
      source.stageFieldDecorator(StagingReplace, "secret", Encrypted, {
        condition: { purpose: "second" },
      });

      const field = metadataFor(source, StagingReplace).fields.find(
        (f) => f.key === "secret",
      )!;

      expect(field.encrypted).toEqual({
        kryptos: null,
        condition: { purpose: "second" },
      });
    });
  });

  describe("multi-source isolation", () => {
    test("two sources stage different selectors on the SAME entity — neither leaks, the shared base is unmutated", () => {
      @Entity({ name: "staging_shared" })
      class StagingShared {
        @PrimaryKeyField() @Generated("uuid") id!: string;

        @Encrypted()
        @Field("string")
        secret!: string;
      }

      const sourceA = track(newSource([StagingShared]));
      const sourceB = track(newSource([StagingShared]));

      sourceA.stageFieldDecorator(StagingShared, "secret", Encrypted, {
        condition: { purpose: "a" },
      });
      sourceB.stageFieldDecorator(StagingShared, "secret", Encrypted, {
        condition: { purpose: "b" },
      });

      const fieldA = metadataFor(sourceA, StagingShared).fields.find(
        (f) => f.key === "secret",
      )!;
      const fieldB = metadataFor(sourceB, StagingShared).fields.find(
        (f) => f.key === "secret",
      )!;

      // Each source carries its OWN selector — neither leaked into the other.
      expect(fieldA.encrypted).toEqual({ kryptos: null, condition: { purpose: "a" } });
      expect(fieldB.encrypted).toEqual({ kryptos: null, condition: { purpose: "b" } });

      // The shared base metadata (what a fresh, un-staged source resolves) is
      // still the bare marker — no staging mutated Entity[Symbol.metadata].
      const shared = getEntityMetadata(StagingShared).fields.find(
        (f) => f.key === "secret",
      )!;
      expect(shared.encrypted).toEqual({ kryptos: null, condition: null });
    });

    test("with no staging the fast path returns the SHARED metadata object (no needless copy)", () => {
      @Entity({ name: "staging_noop" })
      class StagingNoop {
        @PrimaryKeyField() @Generated("uuid") id!: string;

        @Field("string")
        name!: string;
      }

      const source = track(newSource([StagingNoop]));

      expect(metadataFor(source, StagingNoop)).toBe(getEntityMetadata(StagingNoop));
    });
  });

  describe("guards", () => {
    test("throws staged_after_setup once setup() has run", async () => {
      @Entity({ name: "staging_after_setup" })
      class StagingAfterSetup {
        @PrimaryKeyField() @Generated("uuid") id!: string;

        @Field("string")
        name!: string;
      }

      const source = track(newSource([StagingAfterSetup]));
      await source.connect();
      await source.setup();

      const error = getThrown(() =>
        source.stageFieldDecorator(StagingAfterSetup, "name", Encrypted, {
          condition: { purpose: "x" },
        }),
      );

      expect(error).toBeInstanceOf(ProteusError);
      expect((error as ProteusError).code).toBe("staged_after_setup");
    });

    test("throws not_implemented for an unsupported field decorator", () => {
      @Entity({ name: "staging_unsupported_field" })
      class StagingUnsupportedField {
        @PrimaryKeyField() @Generated("uuid") id!: string;

        @Field("string")
        name!: string;
      }

      const source = track(newSource([StagingUnsupportedField]));

      const error = getThrown(() =>
        source.stageFieldDecorator(StagingUnsupportedField, "name", Unsupported as never),
      );

      expect(error).toBeInstanceOf(ProteusError);
      expect((error as ProteusError).code).toBe("not_implemented");
    });

    test("throws not_implemented for any class decorator (none are stageable yet)", () => {
      @Entity({ name: "staging_unsupported_class" })
      class StagingUnsupportedClass {
        @PrimaryKeyField() @Generated("uuid") id!: string;
      }

      const source = track(newSource([StagingUnsupportedClass]));

      const error = getThrown(() =>
        source.stageDecorator(StagingUnsupportedClass, Unsupported as never),
      );

      expect(error).toBeInstanceOf(ProteusError);
      expect((error as ProteusError).code).toBe("not_implemented");
    });
  });
});
