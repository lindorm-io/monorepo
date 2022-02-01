# @lindorm-io/string-blob

String Blob utility for lindorm.io packages

## Installation

```shell script
npm install --save @lindorm-io/string-blob
```

## Usage

```typescript
import { stringifyBlob } from "@lindorm-io/string-blob";

const string = stringifyBlob({
  array: [true, 1, undefined, null, "string"],
  object: {
    string: "string",
  },
  string: "string",
});
// ->
// "json:{array:[true,1,undefined,null,"string"],object:{string:"string"},string:"string"},meta:{[boolean,number,undefined,null,string],{string},string}}"

const object = parseBlob(string);
// ->
// {
//   array: [ true, 1, undefined, null, "string" ],
//   object: {
//     string: "string",
//   },
//   string: "string"
// }
```
