// The studio's pages talk to "/api/..." exactly as on the desktop. On the phone those requests
// never leave the app: fetch() and XMLHttpRequest calls to /api are answered by the in-app
// server, and everything else (AI services, stock libraries) goes out as normal.

import { version } from "../../package.json";
import { app } from "./app";

/**
 * Requests leave the phone through Android's own networking, whose default user agent starts with
 * "Dalvik". Some providers' firewalls (ollama.com among them) answer that with 403, so every
 * outgoing request names the app instead.
 */
export const APP_USER_AGENT = `PromptCutStudio/${version} (Android)`;

function withUserAgent(input: RequestInfo | URL, init?: RequestInit): RequestInit {
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  if (!headers.has("User-Agent")) headers.set("User-Agent", APP_USER_AGENT);
  return { ...init, headers };
}

function isApi(url: string): URL | null {
  try {
    const u = new URL(url, location.href);
    return u.origin === location.origin && u.pathname.startsWith("/api/") ? u : null;
  } catch {
    return null;
  }
}

export function installInAppServer() {
  const realFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const api = isApi(url);
    if (!api) return /^https?:/i.test(url) ? realFetch(input, withUserAgent(input, init)) : realFetch(input, init);
    const request = input instanceof Request ? new Request(input, init) : new Request(api.href, init);
    return Promise.resolve(app.fetch(request));
  };

  // Uploads use XMLHttpRequest for progress. Requests to /api are answered in-app; the upload is
  // local, so progress jumps straight to done.
  const RealXHR = window.XMLHttpRequest;
  class PhoneXHR {
    private real: XMLHttpRequest | null = null;
    private method = "GET";
    private url = "";
    private headers: Record<string, string> = {};
    status = 0;
    responseText = "";
    readyState = 0;
    onload: ((ev: Event) => void) | null = null;
    onerror: ((ev: Event) => void) | null = null;
    upload: { onprogress: ((ev: ProgressEvent) => void) | null } = { onprogress: null };

    open(method: string, url: string) {
      this.method = method;
      this.url = url;
      if (!isApi(url)) {
        this.real = new RealXHR();
        this.real.open(method, url);
        if (/^https?:/i.test(url)) this.real.setRequestHeader("User-Agent", APP_USER_AGENT);
      }
    }

    setRequestHeader(name: string, value: string) {
      if (this.real) this.real.setRequestHeader(name, value);
      else this.headers[name] = value;
    }

    send(body?: Document | XMLHttpRequestBodyInit | null) {
      if (this.real) {
        const real = this.real;
        real.upload.onprogress = (e) => this.upload.onprogress?.(e);
        real.onload = (e) => {
          this.status = real.status;
          this.responseText = real.responseText;
          this.readyState = 4;
          this.onload?.(e);
        };
        real.onerror = (e) => this.onerror?.(e);
        real.send(body as XMLHttpRequestBodyInit);
        return;
      }
      const request = new Request(new URL(this.url, location.href).href, { method: this.method, headers: this.headers, body: (body as BodyInit) ?? undefined });
      void Promise.resolve(app.fetch(request))
        .then(async (res) => {
          this.upload.onprogress?.(new ProgressEvent("progress", { lengthComputable: true, loaded: 1, total: 1 }));
          this.status = res.status;
          this.responseText = await res.text();
          this.readyState = 4;
          this.onload?.(new Event("load"));
        })
        .catch(() => this.onerror?.(new Event("error")));
    }

    abort() {
      this.real?.abort();
    }
  }
  window.XMLHttpRequest = PhoneXHR as unknown as typeof XMLHttpRequest;
}
