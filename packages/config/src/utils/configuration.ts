import dotenvx from "@dotenvx/dotenvx";
import { ChangeCase, changeKeys } from "@lindorm/case";
import { Dict } from "@lindorm/types";
import c from "config";
import { mergeObjectWithProcessEnv } from "./private";

type NpmInformation = { npm: { package: { name: string; version: string } } };

type Configuration<T extends Dict = Dict> = NpmInformation & T;

export const configuration = <T extends Dict = Dict>(
  mode: ChangeCase = ChangeCase.Camel,
): Configuration<T> => {
  dotenvx.config({
    path: process.env.NODE_ENV ? [`.env.${process.env.NODE_ENV}`, ".env"] : ".env",
    quiet: true,
  });

  const merged = mergeObjectWithProcessEnv<T>(process.env, c.util.toObject());
  const config = changeKeys<T>(merged, mode);

  const npm = {
    package: {
      name: process.env.npm_package_name || "",
      version: process.env.npm_package_version || "",
    },
  };

  return { npm, ...config };
};
