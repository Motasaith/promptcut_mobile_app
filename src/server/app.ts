// The studio's server, running inside the phone app. The same route modules the desktop serves,
// with phone versions of storage, media and voices underneath (see vite.config.ts), plus a few
// phone routes that take priority.

import { Hono } from "hono";
import { settingsRoutes } from "./shims/settings";
import { phoneRoutes } from "./phoneRoutes";
import { pro } from "@server/routes";
import { autovideoRoutes } from "@server/autovideo/routes";
import { aiRoutes } from "@server/aiRoutes";

export const app = new Hono();
app.route("/", phoneRoutes);
app.route("/", settingsRoutes);
app.route("/", pro);
app.route("/", autovideoRoutes);
app.route("/", aiRoutes);
app.notFound((c) => c.json({ error: `The phone app has no ${c.req.method} ${new URL(c.req.url).pathname}` }, 404));
app.onError((err, c) => c.json({ error: err.message }, 500));
