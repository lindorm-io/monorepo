import { join } from "path";
import { useStatic } from "../../middleware/http/use-static.js";

const root = join(__dirname, "..", "static-assets");

export const STATIC = useStatic({ root, maxAge: "7d" });
