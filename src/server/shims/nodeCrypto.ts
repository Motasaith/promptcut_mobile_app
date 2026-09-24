// The two things studio server code uses from node:crypto, from the web view's crypto.

import { Buffer } from "buffer";

export function randomBytes(n: number): Buffer {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(n)));
}

export function randomUUID(): string {
  return crypto.randomUUID();
}
