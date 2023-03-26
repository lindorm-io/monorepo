import { ServiceOptions } from "../types";

export const getServiceOptions = (array: any): Array<ServiceOptions> => {
  if (!array) return [];

  if (!Array.isArray(array)) {
    throw new Error("Service options is not an array");
  }

  for (const item of array) {
    if (!item.name) {
      throw new Error("Name not found");
    }
    if (!item.host) {
      throw new Error("Host not found");
    }
    if (item.port && typeof item.port !== "number") {
      throw new Error("Invalid port");
    }
  }

  return array;
};
