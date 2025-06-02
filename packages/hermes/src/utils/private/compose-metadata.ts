import { isBefore } from "@lindorm/date";
import { LindormError } from "@lindorm/errors";
import { isEqual, isObject } from "@lindorm/is";
import { Dict } from "@lindorm/types";

type Meta = { value: any; destroyed: boolean; timestamp: Date };

type ArrayResult = { state: Array<any>; meta: Array<any> };

type ObjectResult<TState> = { state: TState; meta: any };

export const composeArrayMetadata = (
  currentArray: Array<any> = [],
  inputArray: Array<any> = [],
  metadata: Array<any> = [],
  timestamp: Date,
): ArrayResult => {
  const state: Array<any> = [];
  const meta: Array<Meta> = [];

  for (const currentItem of currentArray) {
    /**
     * example: [ { key: 1, number: 1, word: "hello" } ]
     */
    if (isObject(currentItem)) {
      const currentMeta = metadata.find((m) => m.value.key === currentItem.key);
      const inputItem = inputArray.find((i) => i.key === currentItem.key);
      const compareTime =
        currentMeta.timestamp instanceof Date
          ? currentMeta.timestamp
          : new Date(currentMeta.timestamp);

      /**
       * when timestamp is before, that means another change is already there, and we will
       * honor the last successful change.
       */
      if (isBefore(timestamp, compareTime)) {
        meta.push(currentMeta);
        state.push(currentItem);

        /**
         * when the input item is undefined, that means it cannot be found in the update,
         * which means the user has decided to remove it from the array. we therefore skip
         * the state push.
         */
      } else if (inputItem === undefined) {
        meta.push({ value: currentItem, destroyed: true, timestamp });

        /**
         * example: { key: 1, word: "hello" } === { key: 1, word: "hello" }
         */
      } else if (isEqual(currentItem, inputItem)) {
        meta.push(currentMeta);
        state.push(currentItem);

        /**
         * input can be added to the processed change list
         */
      } else {
        meta.push({ value: inputItem, destroyed: false, timestamp });
        state.push(inputItem);
      }

      /**
       * example: [1, 2, 3] => [1, 2]. Number 3 has been removed from the list
       */
    } else if (!inputArray.find((i) => i === currentItem)) {
      meta.push({ value: currentItem, destroyed: true, timestamp });

      /**
       * example: [1, 2, 3] => [1, 2, 3]. Since the numbers are primitive, we do not need
       * to check for any changes. They can either be added or removed. Not changed.
       */
    } else {
      const currentMeta = metadata.find((m) => m.value === currentItem);

      meta.push(currentMeta);
      state.push(currentItem);
    }
  }

  for (const inputItem of inputArray) {
    /**
     * example: [ { key: 2, number: 2, word: "general kenobi" } ]
     */
    if (isObject(inputItem)) {
      if (!inputItem.key) {
        throw new LindormError(
          "Array items need to match [ { key: string } ] to correctly process changes",
          { data: { item: inputItem }, debug: { input: inputArray } },
        );
      }

      /**
       * if we cannot find a matching object in our current array, we can safely
       * add our new input.
       */
      if (!currentArray.find((c) => c.key === inputItem.key)) {
        meta.push({ value: inputItem, destroyed: false, timestamp });
        state.push(inputItem);
      }

      /**
       * example: [1, 2, 3] => [1, 2, 3, 4]. Number 4 has been added to the list
       */
    } else if (!currentArray.find((i) => i === inputItem)) {
      meta.push({ value: inputItem, destroyed: false, timestamp });
      state.push(inputItem);
    }
  }

  return { state, meta };
};

export const composeObjectMetadata = <T = Dict>(
  currentObject: Dict = {},
  inputObject: Dict = {},
  metadata: Dict = {},
  timestamp: Date,
): ObjectResult<T> => {
  const state: Dict = {};
  const meta: Dict<Meta> = metadata;

  for (const key in currentObject) {
    const metaTime = metadata[key] ? metadata[key].timestamp : metadata.timestamp;
    const compareTime = metaTime instanceof Date ? metaTime : new Date(metaTime);

    /**
     * when timestamp is before, that means another change is already there, and we will
     * honor the last successful change.
     */
    if (isBefore(timestamp, compareTime)) {
      meta[key] = metadata[key];
      state[key] = currentObject[key];

      /**
       * when the input item is undefined, that means it cannot be found in the update,
       * which means the user has decided to remove it from the object. we therefore skip
       * the state push.
       */
    } else if (inputObject[key] === undefined) {
      /**
       * if the removed item is an array, we let the array change handler resolve metadata.
       */
      if (Array.isArray(currentObject[key])) {
        const result = composeArrayMetadata(
          currentObject[key],
          inputObject[key],
          metadata[key],
          timestamp,
        );

        meta[key] = result.meta as any;

        /**
         * when the removed item is an object, we let recursively resolve metadata
         */
      } else if (isObject(currentObject[key])) {
        const result = composeObjectMetadata(
          currentObject[key],
          inputObject[key],
          metadata[key],
          timestamp,
        );

        meta[key] = result.meta;

        /**
         * when the object value is a primitive, we can remove it and update metadata
         */
      } else {
        meta[key] = { value: currentObject[key], destroyed: true, timestamp };
      }

      /**
       * when the updated value is an array, we let the array handler resolve state and metadata.
       */
    } else if (Array.isArray(currentObject[key])) {
      const result = composeArrayMetadata(
        currentObject[key],
        inputObject[key],
        metadata[key],
        timestamp,
      );

      meta[key] = result.meta as any;
      state[key] = result.state;

      /**
       * when the updated value is an object, we recursively resolve state and metadata.
       */
    } else if (isObject(currentObject[key])) {
      const result = composeObjectMetadata(
        currentObject[key],
        inputObject[key],
        metadata[key],
        timestamp,
      );

      meta[key] = result.meta;
      state[key] = result.state;

      /**
       * example: { key: 1, word: "hello" } === { key: 1, word: "hello" }
       */
    } else if (isEqual(currentObject[key], inputObject[key])) {
      meta[key] = metadata[key];
      state[key] = currentObject[key];

      /**
       * we can safely assume that the value has changed to something new.
       *
       * example: { one: "word" } => { one: "world" }
       */
    } else {
      meta[key] = { value: inputObject[key], destroyed: false, timestamp };
      state[key] = inputObject[key];
    }
  }

  for (const key in inputObject) {
    /**
     * if we can find anything in our current object, then we have handled it in the logic above.
     */
    if (currentObject[key]) continue;

    /**
     * if the input is an array, we let our array handler resolve state and metadata.
     */
    if (Array.isArray(inputObject[key])) {
      const result = composeArrayMetadata(
        currentObject[key],
        inputObject[key],
        metadata[key],
        timestamp,
      );

      meta[key] = result.meta as any;
      state[key] = result.state;

      /**
       * if the input is an object, we recursively let our handler resolve state and metadata
       */
    } else if (isObject(inputObject[key])) {
      const result = composeObjectMetadata(
        currentObject[key],
        inputObject[key],
        metadata[key],
        timestamp,
      );

      meta[key] = result.meta;
      state[key] = result.state;

      /**
       * we can safely assume that the added value is new.
       *
       * example: { one: "word" }
       */
    } else {
      meta[key] = { value: inputObject[key], destroyed: false, timestamp };
      state[key] = inputObject[key];
    }
  }

  return { state: state as T, meta };
};
