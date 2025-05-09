import dotenvx from "@dotenvx/dotenvx";
import { merge } from "@lindorm/utils";
import { z, ZodRawShape } from "zod";
import { NpmInformation } from "../types";
import { coerceAll, loadConfig, loadNodeConfig } from "./private";

export const configuration = <T extends ZodRawShape>(schema: T): NpmInformation & T => {
  dotenvx.config({
    path: process.env.NODE_ENV ? [`.env.${process.env.NODE_ENV}`, ".env"] : ".env",
    quiet: true,
  });

  const config = loadConfig(process.env);
  const node = loadNodeConfig(process.env);
  const merged = merge(config, node);

  const zod = coerceAll(z.object(schema));
  const parsed = zod.parse(merged);

  const npm = {
    npm: {
      package: {
        name: process.env.npm_package_name || "",
        version: process.env.npm_package_version || "",
      },
    },
  };

  return merge<NpmInformation & T>(parsed, npm as any);
};
