import { log } from 'observe-js';
import type { Level } from 'observe-js';
import { logToConsole, logToObserver } from './config';

type ConsoleFn = (msg: string, attrs?: Record<string, unknown>) => void;

function emit(level: Level, consoleFn: ConsoleFn, msg: string, attrs?: Record<string, unknown>): void {
  if (logToConsole) {
    if (attrs) consoleFn(msg, attrs);
    else consoleFn(msg);
  }
  if (logToObserver) log(level, msg, attrs);
}

export const logger = {
  info(msg: string, attrs?: Record<string, unknown>): void {
    emit('info', console.info, msg, attrs);
  },
  warn(msg: string, attrs?: Record<string, unknown>): void {
    emit('warn', console.warn, msg, attrs);
  },
  error(msg: string, attrs?: Record<string, unknown>): void {
    emit('error', console.error, msg, attrs);
  },
};
