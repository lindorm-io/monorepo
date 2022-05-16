import config from "config";

export const parseConfig = <Configuration>(): Configuration =>
  config.util.toObject() as Configuration;
