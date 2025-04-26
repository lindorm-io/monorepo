import { Dict } from "@lindorm/types";

export type NpmInformation = { npm: { package: { name: string; version: string } } };

export type ProcessEnv = Dict<string | undefined>;
