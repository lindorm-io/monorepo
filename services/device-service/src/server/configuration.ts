import { Configuration } from "../generated/Configuration.generated";
import { parseConfig } from "@lindorm-io/node-server";

export const configuration = parseConfig<Configuration>();
