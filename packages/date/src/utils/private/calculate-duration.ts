import {
  _DAYS,
  _HOURS,
  _MINUTES,
  _MONTHS,
  _SECONDS,
  _WEEKS,
  _YEARS,
} from "../../constants/private/time";
import { DurationString } from "../../enums";

export const _calculateCurrentDuration = (
  milliseconds: number,
  duration: DurationString,
): number => {
  switch (duration) {
    case DurationString.YEARS:
      return milliseconds / _YEARS;

    case DurationString.MONTHS:
      return milliseconds / _MONTHS;

    case DurationString.WEEKS:
      return milliseconds / _WEEKS;

    case DurationString.DAYS:
      return milliseconds / _DAYS;

    case DurationString.HOURS:
      return milliseconds / _HOURS;

    case DurationString.MINUTES:
      return milliseconds / _MINUTES;

    case DurationString.SECONDS:
      return milliseconds / _SECONDS;

    case DurationString.MILLISECONDS:
      return milliseconds;

    default:
      throw new Error(`Invalid duration [ ${duration} ]`);
  }
};

export const calculateRemainingDuration = (
  milliseconds: number,
  duration: DurationString,
): number => {
  switch (duration) {
    case DurationString.YEARS:
      return Math.floor(milliseconds) * _YEARS;

    case DurationString.MONTHS:
      return Math.floor(milliseconds) * _MONTHS;

    case DurationString.WEEKS:
      return Math.floor(milliseconds) * _WEEKS;

    case DurationString.DAYS:
      return Math.floor(milliseconds) * _DAYS;

    case DurationString.HOURS:
      return Math.floor(milliseconds) * _HOURS;

    case DurationString.MINUTES:
      return Math.floor(milliseconds) * _MINUTES;

    case DurationString.SECONDS:
      return Math.floor(milliseconds) * _SECONDS;

    case DurationString.MILLISECONDS:
      return milliseconds;

    default:
      throw new Error(`Invalid duration [ ${duration} ]`);
  }
};
