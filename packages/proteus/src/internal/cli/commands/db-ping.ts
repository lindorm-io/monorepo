import { Logger } from "@lindorm/logger";
import { loadSource } from "../load-source";

type PingOptions = {
  source: string;
  export?: string;
};

export const dbPing = async (options: PingOptions): Promise<void> => {
  try {
    const source = await loadSource(options.source, options.export);

    const start = performance.now();
    await source.connect();

    try {
      await source.ping();
      const elapsed = Math.round(performance.now() - start);
      Logger.std.info(`Connected (${elapsed}ms)`);
    } finally {
      await source.disconnect();
    }
  } catch (error) {
    Logger.std.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
};
