import {
  applyKeyFloor,
  DECRYPT_FLOOR,
  ENVELOPE_FLOOR,
  mergeConditions,
  SEAL_FLOOR,
  SIGN_FLOOR,
  UNPUBLISHED_DEFAULT,
  VERIFY_FLOOR,
} from "../src/index.js";

console.log("sign a token    > ", applyKeyFloor(SIGN_FLOOR, { purpose: "token" }));
console.log("verify a token  > ", applyKeyFloor(VERIFY_FLOOR, { purpose: "token" }));
console.log("seal to a peer  > ", applyKeyFloor(SEAL_FLOOR, { ownerId: "tenant-42" }));

console.log(
  "seal a cookie   > ",
  applyKeyFloor(ENVELOPE_FLOOR, UNPUBLISHED_DEFAULT, { purpose: "cookie" }),
);
console.log(
  "open a cookie   > ",
  applyKeyFloor(DECRYPT_FLOOR, UNPUBLISHED_DEFAULT, { purpose: "cookie" }),
);

console.log(
  "a caller cannot widen a floor > ",
  applyKeyFloor(SIGN_FLOOR, { use: "enc" }),
);

console.log(
  "a later undefined never erases an earlier value > ",
  mergeConditions({ issuer: "https://auth.example.com" }, { issuer: undefined }),
);
