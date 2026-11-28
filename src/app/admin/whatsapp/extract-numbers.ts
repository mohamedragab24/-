/** استخراج نص من ملفات txt / csv / xlsx / pdf داخل المتصفح (من غير مكتبات). الأرقام بتتفلتر وتتضبط على السيرفر. */

const dec = (u8: Uint8Array) => new TextDecoder("utf-8").decode(u8);
const latin = (u8: Uint8Array) => new TextDecoder("latin1").decode(u8);

async function inflate(data: Uint8Array, format: "deflate" | "deflate-raw"): Promise<Uint8Array> {
  const ds = new DecompressionStream(format);
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** فك ZIP بسيط (xlsx): يرجّع الملفات المطلوبة فقط */
async function unzip(buf: Uint8Array, want: (name: string) => boolean): Promise<Record<string, Uint8Array>> {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("ملف xlsx غير صالح");
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out: Record<string, Uint8Array> = {};
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);
    const name = dec(buf.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (!want(name)) continue;
    const lnLen = dv.getUint16(lho + 26, true);
    const lxLen = dv.getUint16(lho + 28, true);
    const start = lho + 30 + lnLen + lxLen;
    const raw = buf.subarray(start, start + csize);
    out[name] = method === 0 ? raw : await inflate(raw, "deflate-raw");
  }
  return out;
}

const xmlText = (xml: string) =>
  xml
    .replace(/<\/(si|row|c)>/g, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");

async function xlsxText(file: File): Promise<string> {
  const files = await unzip(new Uint8Array(await file.arrayBuffer()), (n) => n === "xl/sharedStrings.xml" || /^xl\/worksheets\/[^/]+\.xml$/.test(n));
  const parts: string[] = [];
  for (const [, data] of Object.entries(files)) parts.push(xmlText(dec(data)));
  return parts.join("\n");
}

const unescapePdf = (s: string) =>
  s.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (_, g: string) => {
    if (/^[0-7]+$/.test(g)) return String.fromCharCode(parseInt(g, 8));
    return ({ n: "\n", r: "\n", t: " ", b: "", f: "", "(": "(", ")": ")", "\\": "\\" } as any)[g] ?? g;
  });

/** PDF: محاولة بأقصى جهد لاستخراج النص من الـ streams. ملفات الصور الممسوحة أو الخطوط المشفّرة قد لا تطلع منها أرقام. */
async function pdfText(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const s = latin(buf);
  const out: string[] = [];
  const re = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const start = m.index + m[0].length;
    const end = s.indexOf("endstream", start);
    if (end < 0) break;
    let stop = end;
    while (stop > start && (buf[stop - 1] === 10 || buf[stop - 1] === 13)) stop--;
    const chunk = buf.subarray(start, stop);
    let content = "";
    try { content = latin(await inflate(chunk, "deflate")); } catch { content = latin(chunk); }
    if (!/(Tj|TJ)/.test(content)) { re.lastIndex = end; continue; }
    const ops = content.match(/\[(?:\\.|[^\]])*\]\s*TJ|\((?:\\.|[^\\)])*\)\s*Tj/g) || [];
    for (const op of ops) {
      const strs = op.match(/\((?:\\.|[^\\)])*\)/g) || [];
      out.push(strs.map((x) => unescapePdf(x.slice(1, -1))).join(""));
    }
    re.lastIndex = end;
  }
  return out.join("\n");
}

export async function fileToText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx")) return xlsxText(file);
  if (name.endsWith(".pdf")) return pdfText(file);
  if (name.endsWith(".xls")) throw new Error("صيغة xls القديمة مش مدعومة. احفظ الملف كـ xlsx أو csv.");
  return file.text();
}
