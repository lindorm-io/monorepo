import type { LindormErrorOptions } from "../errors/LindormError.js";

export type HttpErrorOptions = Omit<LindormErrorOptions, "status">;
