import type { EntityMetadata, MetaRelation } from "../../entity/types/metadata";
import type { IncludeSpec } from "../../types/query";
import { ProteusError } from "../../../errors";
import { warnCartesianIncludes } from "./warn-cartesian-includes";
import { describe, expect, test, vi } from "vitest";

const makeRelation = (key: string, type: MetaRelation["type"]): MetaRelation =>
  ({ key, type, options: {} }) as unknown as MetaRelation;

const makeInclude = (relation: string): IncludeSpec => ({
  relation,
  required: false,
  strategy: "join",
  select: null,
  where: null,
});

const metadata = {
  entity: { name: "User" },
  relations: [
    makeRelation("posts", "OneToMany"),
    makeRelation("tags", "ManyToMany"),
    makeRelation("author", "ManyToOne"),
    makeRelation("profile", "OneToOne"),
    makeRelation("comments", "OneToMany"),
  ],
} as unknown as EntityMetadata;

describe("warnCartesianIncludes", () => {
  test("should not warn when no *ToMany joins", () => {
    const logger = { warn: vi.fn() } as any;
    warnCartesianIncludes(
      [makeInclude("author"), makeInclude("profile")],
      metadata,
      logger,
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test("should not warn when only one *ToMany join", () => {
    const logger = { warn: vi.fn() } as any;
    warnCartesianIncludes(
      [makeInclude("posts"), makeInclude("author")],
      metadata,
      logger,
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test("should warn when 2+ *ToMany relations are joined", () => {
    const logger = { warn: vi.fn() } as any;
    warnCartesianIncludes([makeInclude("posts"), makeInclude("tags")], metadata, logger);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("cartesian explosion"),
    );
  });

  test("should warn when 3+ *ToMany relations are joined", () => {
    const logger = { warn: vi.fn() } as any;
    warnCartesianIncludes(
      [makeInclude("posts"), makeInclude("tags"), makeInclude("comments")],
      metadata,
      logger,
    );
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("3 *ToMany relations"),
    );
  });

  test("should include relation names in warning", () => {
    const logger = { warn: vi.fn() } as any;
    warnCartesianIncludes([makeInclude("posts"), makeInclude("tags")], metadata, logger);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("posts, tags"));
  });

  test("should match full warning message snapshot for 2-ToMany joins", () => {
    const logger = { warn: vi.fn() } as any;
    warnCartesianIncludes([makeInclude("posts"), makeInclude("tags")], metadata, logger);
    expect(logger.warn.mock.calls[0]).toMatchSnapshot();
  });

  test("should throw ProteusError when include references an unknown relation key", () => {
    const logger = { warn: vi.fn() } as any;
    expect(() =>
      warnCartesianIncludes([makeInclude("nonExistentRelation")], metadata, logger),
    ).toThrow(ProteusError);
    expect(() =>
      warnCartesianIncludes([makeInclude("nonExistentRelation")], metadata, logger),
    ).toThrow("nonExistentRelation");
  });
});
