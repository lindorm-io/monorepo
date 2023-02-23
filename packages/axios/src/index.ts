import { Axios } from "./class";

export * from "./class";
export * from "./enum";
export * from "./middleware";
export * from "./types";

const axios = new Axios();
export { axios };
