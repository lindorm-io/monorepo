import { isUndefined } from "@lindorm/is";

if (isUndefined((Symbol as { metadata?: symbol }).metadata)) {
  (Symbol as { metadata?: symbol }).metadata = Symbol.for("Symbol.metadata");
}
