import { DisplayName, DisplayNameOptions } from "../../entity";

export const getTestDisplayName = (options: Partial<DisplayNameOptions> = {}): DisplayName =>
  new DisplayName({
    name: "displayName",
    numbers: [1234],
    ...options,
  });
