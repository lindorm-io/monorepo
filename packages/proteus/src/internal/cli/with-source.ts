import { Logger } from "@lindorm/logger";
import { ProteusSource } from "../../classes/ProteusSource.js";
import { loadSource } from "./load-source.js";

export type GlobalOptions = {
  source: string;
  export?: string;
  verbose?: boolean;
};

export type SourceContext = {
  source: ProteusSource;
};

export const withSource = async (
  options: GlobalOptions,
  fn: (ctx: SourceContext) => Promise<void>,
): Promise<void> => {
  try {
    const source = await loadSource(options.source, options.export);
    await source.connect();

    try {
      await fn({ source });
    } finally {
      await source.disconnect();
    }
  } catch (error) {
    Logger.std.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
};

export const withSourceConfig = async (
  options: GlobalOptions,
  fn: (ctx: { source: ProteusSource }) => Promise<void>,
): Promise<void> => {
  try {
    const source = await loadSource(options.source, options.export);
    await fn({ source });
  } catch (error) {
    Logger.std.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
};
