import { isAfter, isBefore, isEqual } from "@lindorm/date";
import { isArray, isDate, isNumber, isString } from "@lindorm/is";
import { Operators } from "../../types";

export const validateValue = (value: any, operators: Operators): boolean => {
  if (operators.$exists === true && !value) {
    return false;
  }

  if (operators.$exists === false && value) {
    return false;
  }

  if (operators.$eq) {
    if (isDate(value) && !isEqual(value, operators.$eq)) {
      return false;
    } else if (value !== operators.$eq) {
      return false;
    }
  }

  if (operators.$ne) {
    if (isDate(value) && isEqual(value, operators.$ne)) {
      return false;
    } else if (value === operators.$ne) {
      return false;
    }
  }

  if (operators.$in && !operators.$in.includes(value)) {
    return false;
  }

  if (operators.$nin && operators.$nin.includes(value)) {
    return false;
  }

  // arrays

  if (operators.$has && (!isArray(value) || !value.includes(operators.$has))) {
    return false;
  }

  if (operators.$not && (!isArray(value) || value.includes(operators.$not))) {
    return false;
  }

  if (
    operators.$all &&
    (!isArray(value) || !operators.$all.every((v) => value.includes(v)))
  ) {
    return false;
  }

  if (
    operators.$any &&
    (!isArray(value) || !operators.$any.some((v) => value.includes(v)))
  ) {
    return false;
  }

  if (
    operators.$none &&
    (!isArray(value) || operators.$none.some((v) => value.includes(v)))
  ) {
    return false;
  }

  // dates

  if (operators.$before && (!isDate(value) || !isBefore(value, operators.$before))) {
    return false;
  }

  if (
    operators.$beforeOrEq &&
    (!isDate(value) || isAfter(value, operators.$beforeOrEq))
  ) {
    return false;
  }

  if (operators.$after && (!isDate(value) || !isAfter(value, operators.$after))) {
    return false;
  }

  if (operators.$afterOrEq && (!isDate(value) || isBefore(value, operators.$afterOrEq))) {
    return false;
  }

  // numbers

  if (operators.$gt && (!isNumber(value) || operators.$gt >= value)) {
    return false;
  }

  if (operators.$gte && (!isNumber(value) || operators.$gte > value)) {
    return false;
  }

  if (operators.$lt && (!isNumber(value) || operators.$lt <= value)) {
    return false;
  }

  if (operators.$lte && (!isNumber(value) || operators.$lte < value)) {
    return false;
  }

  // strings

  if (
    operators.$regex &&
    (!isString(value) || !new RegExp(operators.$regex).test(value))
  ) {
    return false;
  }

  // logical

  if (operators.$and && !operators.$and.every((op) => validateValue(value, op))) {
    return false;
  }

  if (operators.$or && !operators.$or.some((op) => validateValue(value, op))) {
    return false;
  }

  return true;
};
