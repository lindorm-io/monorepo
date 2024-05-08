import { Dict } from "@lindorm/types";

export type LogContext = Array<string>;

export type LogDetails = Dict | Error | null | undefined;

export type LogSession = Record<string, string | number | boolean>;

export type FilterCallback = (data: any) => string;

export type FilterRecord = Record<string, FilterCallback | undefined>;
