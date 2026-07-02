import { lindormSymbol } from "@lindorm/utils";

/**
 * Global-registry brand for `ProteusSource`, shared by the class (which stamps
 * it) and the CLI source loader (which checks it). Built via `lindormSymbol` so
 * it resolves to the same symbol across duplicate installs — the CLI can load a
 * user's source file that resolves a different physical copy of @lindorm/proteus.
 */
export const PROTEUS_SOURCE_BRAND = lindormSymbol("proteus", "brand", "source");
