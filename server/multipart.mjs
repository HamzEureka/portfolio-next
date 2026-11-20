// STATUS: UNVERIFIED (Claude, M11). Minimal multipart/form-data parser (no dependency): enough for one `file` field.
/** @returns {{ name: string, filename: string|null, contentType: string, data: Buffer }[] | null} null when the body is malformed. */
export function parseMultipart(body, contentTypeHeader) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentTypeHeader || "");
  const boundary = m && (m[1] || m[2]).trim();
  if (!boundary || boundary.length > 200) return null;
  const delim = Buffer.from("--" + boundary);
  const parts = [];
  let pos = body.indexOf(delim);
  if (pos !== 0) return null;
  while (true) {
    pos += delim.length;
    if (body.subarray(pos, pos + 2).toString("latin1") === "--") return parts; // closing delimiter
    if (body.subarray(pos, pos + 2).toString("latin1") !== "\r\n") return null;
    pos += 2;
    const headEnd = body.indexOf("\r\n\r\n", pos);
    if (headEnd < 0) return null;
    const head = body.subarray(pos, headEnd).toString("utf8");
    const next = body.indexOf(Buffer.concat([Buffer.from("\r\n"), delim]), headEnd + 4);
    if (next < 0) return null;
    const data = body.subarray(headEnd + 4, next);
    const cd = /^content-disposition:\s*form-data;(.*)$/im.exec(head);
    const name = cd && /\bname="([^"]*)"/i.exec(cd[1]);
    const fn = cd && /\bfilename="([^"]*)"/i.exec(cd[1]);
    const ct = /^content-type:\s*([^\r\n]+)/im.exec(head);
    if (!cd || !name) return null;
    parts.push({ name: name[1], filename: fn ? fn[1] : null, contentType: ct ? ct[1].trim().toLowerCase() : "", data });
    if (parts.length > 5) return null;
    pos = next + 2; // skip CRLF, now at the delimiter
  }
}
