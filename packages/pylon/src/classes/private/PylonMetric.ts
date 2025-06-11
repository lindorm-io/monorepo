import { camelCase } from "@lindorm/case";
import { ILogger } from "@lindorm/logger";

type Options = {
  logger: ILogger;
  name: string;
};

export class PylonMetric {
  public readonly name: string;
  public readonly timestamp: number;

  private readonly logger: ILogger;

  public constructor(options: Options) {
    this.logger = options.logger.child(["PylonMetric"]);
    this.name = camelCase(options.name);
    this.timestamp = Date.now();
  }

  public end(): void {
    this.logger.silly("Metric end", {
      name: this.name,
      time: Date.now() - this.timestamp,
    });
  }
}
