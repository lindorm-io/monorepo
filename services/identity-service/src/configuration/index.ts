import config from "config";
import { Configuration } from "../generated/Configuration.generated";

export const configuration = config.util.toObject() as Configuration;
