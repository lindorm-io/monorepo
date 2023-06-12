import { DisplayName, DisplayNameOptions } from "../../entity";

export const createTestDisplayName = (options: Partial<DisplayNameOptions> = {}): DisplayName =>
  new DisplayName({
    name: "displayName",
    number: 0,
    ...options,
  });
