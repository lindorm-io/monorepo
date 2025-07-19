type Method = "Get" | "Post" | "Put" | "Delete" | "Patch" | "Options" | "Head";
type MethodLower = Lowercase<Method>;
type MethodUpper = Uppercase<Method>;

export type HttpMethod = Method | MethodLower | MethodUpper;
