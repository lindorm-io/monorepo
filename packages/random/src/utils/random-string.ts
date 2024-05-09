import { _createRandomString } from "./private/create-random-string";

export const randomString = (length: number): string => _createRandomString(length);
