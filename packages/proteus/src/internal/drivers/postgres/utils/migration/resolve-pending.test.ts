import { describe, expect, it, vi } from "vitest";
import type {
  LoadedMigration,
  MigrationInterface,
  MigrationRecord,
} from "../../types/migration.js";
import { resolvePending } from "./resolve-pending.js";

const makeMigration = (
  overrides: Partial<MigrationInterface> = {},
): MigrationInterface => ({
  id: "aaa-111",
  ts: "2026-02-20T09:00:00.000Z",
  up: vi.fn(),
  down: vi.fn(),
  ...overrides,
});

const makeLoaded = (
  name: string,
  overrides: Partial<MigrationInterface> = {},
): LoadedMigration => ({
  migration: makeMigration(overrides),
  name,
});

const makeRecord = (overrides: Partial<MigrationRecord> = {}): MigrationRecord => ({
  id: "aaa-111",
  name: "20260220090000-init",
  checksum: "abc123",
  createdAt: new Date("2026-02-20T09:00:00.000Z"),
  startedAt: new Date("2026-02-20T10:00:00.000Z"),
  finishedAt: new Date("2026-02-20T10:00:01.000Z"),
  rolledBackAt: null,
  ...overrides,
});

describe("resolvePending", () => {
  it("should mark all migrations as pending when none are applied", () => {
    const loaded = [
      makeLoaded("20260220090000-init", { id: "aaa-111" }),
      makeLoaded("20260221090000-add-users", { id: "bbb-222" }),
    ];
    const { resolved } = resolvePending(loaded, [], () => "hash");
    expect(resolved).toMatchSnapshot();
  });

  it("should mark migration as applied when checksum matches", () => {
    const loaded = [makeLoaded("20260220090000-init", { id: "aaa-111" })];
    const applied = [makeRecord({ id: "aaa-111", checksum: "correct-hash" })];
    const { resolved } = resolvePending(loaded, applied, () => "correct-hash");
    expect(resolved).toMatchSnapshot();
  });

  it("should mark migration as checksum_mismatch when checksum differs", () => {
    const loaded = [makeLoaded("20260220090000-init", { id: "aaa-111" })];
    const applied = [makeRecord({ id: "aaa-111", checksum: "old-hash" })];
    const { resolved } = resolvePending(loaded, applied, () => "new-hash");
    expect(resolved).toMatchSnapshot();
  });

  it("should handle mixed pending and applied migrations", () => {
    const loaded = [
      makeLoaded("20260220090000-first", {
        id: "aaa-111",
        ts: "2026-02-20T09:00:00.000Z",
      }),
      makeLoaded("20260221090000-second", {
        id: "bbb-222",
        ts: "2026-02-21T09:00:00.000Z",
      }),
      makeLoaded("20260222090000-third", {
        id: "ccc-333",
        ts: "2026-02-22T09:00:00.000Z",
      }),
    ];
    const applied = [makeRecord({ id: "aaa-111", checksum: "hash-1" })];
    const { resolved } = resolvePending(loaded, applied, (m) =>
      m.id === "aaa-111" ? "hash-1" : "hash-new",
    );
    expect(
      resolved.map((r) => ({ id: r.migration.id, status: r.status })),
    ).toMatchSnapshot();
  });

  it("should match by migration ID", () => {
    const loaded = [makeLoaded("20260220090000-init", { id: "specific-uuid" })];
    const applied = [
      makeRecord({ id: "specific-uuid", name: "some-name", checksum: "h" }),
    ];
    const { resolved } = resolvePending(loaded, applied, () => "h");
    expect(resolved[0].status).toBe("applied");
    expect(resolved[0].name).toBe("some-name");
  });

  it("should use loaded name for pending migrations", () => {
    const loaded = [makeLoaded("20260220090000-add-email", { id: "uuid-123" })];
    const { resolved } = resolvePending(loaded, [], () => "hash");
    expect(resolved[0].name).toBe("20260220090000-add-email");
    expect(resolved[0].status).toBe("pending");
  });

  it("should return ghost records for applied migrations with no source file", () => {
    const loaded = [makeLoaded("20260220090000-init", { id: "aaa-111" })];
    const applied = [
      makeRecord({ id: "aaa-111", checksum: "hash-a" }),
      makeRecord({
        id: "ghost-uuid",
        name: "20260215090000-deleted-migration",
        checksum: "ghost-hash",
        finishedAt: new Date("2026-02-15T10:00:00.000Z"),
      }),
    ];
    const { resolved, ghosts } = resolvePending(loaded, applied, () => "hash-a");
    expect(resolved).toHaveLength(1);
    expect(resolved[0].status).toBe("applied");
    expect(ghosts).toHaveLength(1);
    expect(ghosts[0]).toMatchSnapshot();
  });

  it("should return empty ghosts when all applied records have source files", () => {
    const loaded = [makeLoaded("20260220090000-init", { id: "aaa-111" })];
    const applied = [makeRecord({ id: "aaa-111", checksum: "h" })];
    const { ghosts } = resolvePending(loaded, applied, () => "h");
    expect(ghosts).toHaveLength(0);
  });
});
