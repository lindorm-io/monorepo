import { lindormId } from "../src/index.js";

console.log("random id (default) > ", lindormId());
console.log("random id (16)      > ", lindormId({ length: 16 }));
console.log("random id (24)      > ", lindormId({ length: 24 }));
console.log("random id (32)      > ", lindormId({ length: 32 }));
console.log("random id (48)      > ", lindormId({ length: 48 }));
console.log("random id (64)      > ", lindormId({ length: 64 }));

console.log("namespaced          > ", lindormId("usr"));
console.log("namespaced (16)     > ", lindormId("usr", { length: 16 }));
