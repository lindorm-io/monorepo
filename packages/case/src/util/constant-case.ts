import { constantCase as fn } from "change-case";
import { CaseInput } from "../types";
import { convertCase } from "./private";

export const constantCase = <T = any>(input: CaseInput): T => convertCase(input, fn);
