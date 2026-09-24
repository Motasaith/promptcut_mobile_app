// The studio's bundled files (fonts, stickers, illustrations) ship inside the app.

export async function publicText(path: string): Promise<string> {
  const res = await fetch(`/${path}`);
  if (!res.ok) throw new Error(`Missing bundled file ${path}`);
  return res.text();
}
