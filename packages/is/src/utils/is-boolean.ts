export const isBoolean = (input?: any): input is boolean => typeof input === "boolean";

export const isTrue = (input?: any): input is true => input === true;

export const isFalse = (input?: any): input is false => input === false;
