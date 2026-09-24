// Studio server code uses Node's Buffer; the web view gets the browser build of it. This module
// is imported first, before any studio code runs.

import { Buffer } from "buffer";

const g = globalThis as unknown as { Buffer?: typeof Buffer };
g.Buffer ??= Buffer;
