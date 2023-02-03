import {DateTimeFormatter} from "@js-joda/core";

export const DATE_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd");
export const TIME_FORMAT = DateTimeFormatter.ofPattern("HH:mm:ss");
export const DATE_TIME_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
