import { randomUUID } from 'node:crypto';

export function uuid(): string {
  return randomUUID();
}

let counter = 0;
export function shortId(prefix = 'id'): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
