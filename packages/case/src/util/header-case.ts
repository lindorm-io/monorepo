import { CaseInput } from "../types";
import { convertCase } from "./private";
import { headerCase as _headerCase } from "change-case";

export const headerCase = <T = any>(input: CaseInput): T => convertCase(input, _headerCase);
