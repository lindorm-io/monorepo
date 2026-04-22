import type { IProteusRepositoryProvider } from "./ProteusRepositoryProvider.js";

// Request-scoped data access handle. Extends provider with no additions.
// Named type for use on framework contexts (e.g. Pylon's ctx.proteus).
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface IProteusSession extends IProteusRepositoryProvider {}
