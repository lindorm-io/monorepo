import type { ZephyrAuth } from "../../types/options";

export const resolveBearer = async (auth: ZephyrAuth): Promise<string> =>
  typeof auth.bearer === "function" ? auth.bearer() : auth.bearer;
