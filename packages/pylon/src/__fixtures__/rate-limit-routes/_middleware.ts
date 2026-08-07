import { useRateLimit } from "../../middleware/common/use-rate-limit.js";

// A deployment mounting its OWN global limiter — the only way one is ever
// installed. No arguments: the window, ceiling, strategy, key and skip all live
// on `ctx.state.app.config.rateLimit`, so this mount carries no second copy of
// them free to disagree with the policy every route-level mount reads.
export const MIDDLEWARE = [useRateLimit()];
