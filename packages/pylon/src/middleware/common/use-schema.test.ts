import { ClientError, ServerError } from "@lindorm/errors";
import { z } from "zod";
import { useSchema } from "./use-schema";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("useSchema", () => {
  describe("HTTP context", () => {
    let ctx: any;

    beforeEach(() => {
      ctx = {
        request: {},
        headers: {
          "header-boolean": "true",
          "header-ignore": "ignore",
          "header-key": "header-value",
        },
        data: {
          key: "value",
          number: "123",
        },
      };
    });

    test("should validate and coerce data", async () => {
      await expect(
        useSchema(
          z.object({
            key: z.string(),
            number: z.coerce.number(),
          }),
        )(ctx, vi.fn()),
      ).resolves.toBeUndefined();

      expect(ctx.data).toEqual({
        key: "value",
        number: 123,
      });
    });

    test("should validate headers", async () => {
      await expect(
        useSchema(
          z.object({
            "header-boolean": z.coerce.boolean(),
            "header-key": z.string(),
          }),
          "headers",
        )(ctx, vi.fn()),
      ).resolves.toBeUndefined();

      expect(ctx.headers).toEqual({
        "header-boolean": true,
        "header-ignore": "ignore",
        "header-key": "header-value",
      });
    });

    test("should throw ClientError on validation failure", async () => {
      ctx.data.number = "not-a-number";

      await expect(
        useSchema(
          z.object({
            key: z.string(),
            number: z.coerce.number(),
          }),
        )(ctx, vi.fn()),
      ).rejects.toThrow(ClientError);
    });

    test("should call next", async () => {
      const next = vi.fn();

      await useSchema(z.object({ key: z.string() }))(ctx, next);

      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe("socket context", () => {
    let ctx: any;

    beforeEach(() => {
      ctx = {
        socket: {},
        data: {
          key: "value",
          number: "123",
        },
      };
    });

    test("should validate data on socket context", async () => {
      await expect(
        useSchema(
          z.object({
            key: z.string(),
            number: z.coerce.number(),
          }),
        )(ctx, vi.fn()),
      ).resolves.toBeUndefined();

      expect(ctx.data).toEqual({
        key: "value",
        number: 123,
      });
    });

    test("should throw ServerError when using headers path on socket context", async () => {
      await expect(
        useSchema(z.object({ key: z.string() }), "headers")(ctx, vi.fn()),
      ).rejects.toThrow(ServerError);
    });

    test("should throw ServerError when using body path on socket context", async () => {
      await expect(
        useSchema(z.object({ key: z.string() }), "body")(ctx, vi.fn()),
      ).rejects.toThrow(ServerError);
    });

    test("should throw ServerError when using query path on socket context", async () => {
      await expect(
        useSchema(z.object({ key: z.string() }), "query")(ctx, vi.fn()),
      ).rejects.toThrow(ServerError);
    });
  });
});
