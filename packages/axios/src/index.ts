import { TransformMode } from "@lindorm-io/case";
import { Axios } from "./class";

const axios = new Axios();

export * from "./class";
export * from "./enum";
export * from "./middleware";
export * from "./types";
export { TransformMode, axios };
