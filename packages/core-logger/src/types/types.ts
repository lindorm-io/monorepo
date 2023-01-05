export type ConsoleOptions = {
  colours: boolean;
  readable: boolean;
  timestamp: boolean;
};

export type FilterCallback = (data: any) => string;

export type FilterRecord = Record<string, FilterCallback>;

export type Level = "error" | "warn" | "info" | "verbose" | "debug" | "silly";

export type LogContext = Array<string> | string | number;

export type LogDetails = Record<string, any> | Error | null | undefined;

export type LogSession = Record<string, string | number | boolean>;
