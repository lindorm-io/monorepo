import { IProteusRepositoryProvider } from "./ProteusRepositoryProvider";

// Request-scoped data access handle. Extends provider with no additions.
// Named type for use on framework contexts (e.g. Pylon's ctx.proteus).
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface IProteusSession<C = unknown> extends IProteusRepositoryProvider<C> {}
