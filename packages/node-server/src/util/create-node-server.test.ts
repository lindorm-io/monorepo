import { createNodeServer } from "./create-node-server";
import { KoaApp } from "@lindorm-io/koa";
import { logger } from "../test";

describe("createNodeServer", () => {
  test("should create koa app", () => {
    expect(
      createNodeServer({
        host: "host",
        port: 4000,
        logger,
      }),
    ).toBeInstanceOf(KoaApp);
  });
});
