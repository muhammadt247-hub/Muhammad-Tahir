/**
 * DOCTORx Metadata Embedding Engine
 *
 * Embeds Title, Description, and Keywords into JPEG and PNG image files
 * WITHOUT re-encoding image pixels (ensuring 100% byte-identical pixel fidelity).
 *
 * Supported formats:
 * - JPEG: EXIF (ImageDescription, XPTitle, XPKeywords), IPTC (ObjectName, Headline, Caption, Keywords), and XMP (dc:title, dc:description, dc:subject)
 * - PNG: XMP packet inside standard iTXt chunk (XML:com.adobe.xmp) with valid CRC-32
 */

// Helper to escape XML special characters
function escapeXml(unsafe: string): string {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Convert string to UTF-16LE bytes with null terminator (for Windows XP EXIF tags)
function toUtf16Le(str: string): Uint8Array {
  const buf = new Uint8Array((str.length + 1) * 2);
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    buf[i * 2] = code & 0xff;
    buf[i * 2 + 1] = (code >> 8) & 0xff;
  }
  buf[str.length * 2] = 0;
  buf[str.length * 2 + 1] = 0;
  return buf;
}

// Table-driven IEEE 802.3 CRC-32 for PNG chunks
let crcTable: Uint32Array | null = null;
function getCrcTable(): Uint32Array {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) {
        c = 0xedb88320 ^ (c >>> 1);
      } else {
        c = c >>> 1;
      }
    }
    crcTable[n] = c;
  }
  return crcTable;
}

export function crc32(buf: Uint8Array): number {
  const table = getCrcTable();
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Builds an Adobe-compliant XMP packet (RDF/XML)
 */
export function buildXmpPacket(title: string, description: string, keywords: string[]): string {
  const escTitle = escapeXml(title);
  const escDesc = escapeXml(description);
  const keywordsXml = (keywords || [])
    .filter(Boolean)
    .map((k) => `     <rdf:li>${escapeXml(k.trim())}</rdf:li>`)
    .join('\n');

  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="DOCTORx Toolkit">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"
    xmlns:Iptc4xmpCore="http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/">
   <dc:title>
    <rdf:Alt>
     <rdf:li xml:lang="x-default">${escTitle}</rdf:li>
    </rdf:Alt>
   </dc:title>
   <dc:description>
    <rdf:Alt>
     <rdf:li xml:lang="x-default">${escDesc}</rdf:li>
    </rdf:Alt>
   </dc:description>
   <dc:subject>
    <rdf:Bag>
${keywordsXml}
    </rdf:Bag>
   </dc:subject>
   <photoshop:Headline>${escTitle}</photoshop:Headline>
   <photoshop:Caption>${escDesc}</photoshop:Caption>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

/**
 * Builds JPEG APP1 XMP segment
 */
function buildJpegXmpSegment(xmpPacket: string): Uint8Array {
  const encoder = new TextEncoder();
  const header = encoder.encode('http://ns.adobe.com/xap/1.0/\0');
  const xmpBytes = encoder.encode(xmpPacket);
  const payloadLen = header.length + xmpBytes.length;
  const markerLen = 2 + payloadLen;

  if (markerLen > 65535) {
    throw new Error('XMP metadata exceeds 64KB JPEG marker limit');
  }

  const segment = new Uint8Array(2 + markerLen);
  segment[0] = 0xff;
  segment[1] = 0xe1; // APP1
  segment[2] = (markerLen >> 8) & 0xff;
  segment[3] = markerLen & 0xff;
  segment.set(header, 4);
  segment.set(xmpBytes, 4 + header.length);
  return segment;
}

/**
 * Builds JPEG APP13 IPTC / Photoshop 3.0 segment
 */
function buildJpegIptcSegment(title: string, description: string, keywords: string[]): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];

  const addTag = (record: number, dataset: number, str: string) => {
    const bytes = encoder.encode(str);
    if (bytes.length === 0) return;
    const len = bytes.length;
    const header = new Uint8Array([0x1c, record, dataset, (len >> 8) & 0xff, len & 0xff]);
    chunks.push(header, bytes);
  };

  // 1:90 Coded Character Set: UTF-8 (\x1B\x25\x47)
  chunks.push(new Uint8Array([0x1c, 0x01, 0x5a, 0x00, 0x03, 0x1b, 0x25, 0x47]));

  // 2:05 ObjectName (Title)
  if (title) addTag(2, 5, title);

  // 2:105 Headline (Title)
  if (title) addTag(2, 105, title);

  // 2:120 Caption-Abstract (Description)
  if (description) addTag(2, 120, description);

  // 2:25 Keywords (one per keyword)
  for (const kw of keywords) {
    const trimmed = kw.trim();
    if (trimmed) addTag(2, 25, trimmed);
  }

  // Concatenate IPTC payload
  const iptcLen = chunks.reduce((acc, c) => acc + c.length, 0);
  const iptcBytes = new Uint8Array(iptcLen);
  let pos = 0;
  for (const c of chunks) {
    iptcBytes.set(c, pos);
    pos += c.length;
  }

  // Wrap inside Photoshop 8BIM IPTC-NAA resource
  const isOdd = iptcBytes.length % 2 !== 0;
  const paddedLen = iptcBytes.length + (isOdd ? 1 : 0);

  const bimHeader = new Uint8Array(12);
  // '8BIM'
  bimHeader[0] = 0x38;
  bimHeader[1] = 0x42;
  bimHeader[2] = 0x49;
  bimHeader[3] = 0x4d;
  // 0x0404 (IPTC-NAA)
  bimHeader[4] = 0x04;
  bimHeader[5] = 0x04;
  // Resource name (empty, 2 bytes null)
  bimHeader[6] = 0x00;
  bimHeader[7] = 0x00;
  // Resource size (Uint32 Big-Endian)
  const view = new DataView(bimHeader.buffer);
  view.setUint32(8, iptcBytes.length, false);

  const bimBlock = new Uint8Array(12 + paddedLen);
  bimBlock.set(bimHeader, 0);
  bimBlock.set(iptcBytes, 12);
  if (isOdd) bimBlock[12 + iptcBytes.length] = 0;

  // Photoshop 3.0 APP13 header
  const psHeader = encoder.encode('Photoshop 3.0\0');
  const payloadLen = psHeader.length + bimBlock.length;
  const markerLen = 2 + payloadLen;

  if (markerLen > 65535) {
    return new Uint8Array(0);
  }

  const app13 = new Uint8Array(2 + markerLen);
  app13[0] = 0xff;
  app13[1] = 0xed; // APP13
  app13[2] = (markerLen >> 8) & 0xff;
  app13[3] = markerLen & 0xff;
  app13.set(psHeader, 4);
  app13.set(bimBlock, 4 + psHeader.length);

  return app13;
}

/**
 * Builds JPEG APP1 EXIF segment (TIFF structure with ImageDescription, XPTitle, XPKeywords)
 */
function buildJpegExifSegment(title: string, description: string, keywords: string[]): Uint8Array {
  const encoder = new TextEncoder();
  const descBytes = encoder.encode(description ? description + '\0' : '');
  const xpTitleBytes = title ? toUtf16Le(title) : new Uint8Array(0);
  const xpKeywordsBytes = keywords.length > 0 ? toUtf16Le(keywords.join('; ')) : new Uint8Array(0);
  const softwareBytes = encoder.encode('DOCTORx\0');

  // Build IFD entries (Little-Endian 'II')
  type IfdEntry = { tag: number; type: number; count: number; data: Uint8Array | number };
  const entries: IfdEntry[] = [];

  if (descBytes.length > 0) {
    entries.push({ tag: 0x010e, type: 2, count: descBytes.length, data: descBytes }); // ImageDescription
  }
  entries.push({ tag: 0x0131, type: 2, count: softwareBytes.length, data: softwareBytes }); // Software
  if (xpTitleBytes.length > 0) {
    entries.push({ tag: 0x9c9b, type: 1, count: xpTitleBytes.length, data: xpTitleBytes }); // XPTitle
  }
  if (xpKeywordsBytes.length > 0) {
    entries.push({ tag: 0x9c9e, type: 1, count: xpKeywordsBytes.length, data: xpKeywordsBytes }); // XPKeywords
  }

  // Sort entries by tag ascending (standard TIFF requirement)
  entries.sort((a, b) => a.tag - b.tag);

  // TIFF Header: 8 bytes
  // IFD: 2 bytes (count) + N * 12 bytes + 4 bytes (next IFD = 0)
  const ifdOffset = 8;
  const ifdSize = 2 + entries.length * 12 + 4;
  let dataOffset = ifdOffset + ifdSize;

  // Calculate total TIFF length
  let totalDataLen = 0;
  for (const entry of entries) {
    if (typeof entry.data !== 'number' && entry.data.length > 4) {
      totalDataLen += entry.data.length + (entry.data.length % 2); // 2-byte alignment
    }
  }

  const tiffBuffer = new Uint8Array(ifdOffset + ifdSize + totalDataLen);
  const tiffView = new DataView(tiffBuffer.buffer);

  // TIFF Header: 'II' (Little Endian)
  tiffBuffer[0] = 0x49;
  tiffBuffer[1] = 0x49;
  tiffView.setUint16(2, 42, true);
  tiffView.setUint32(4, ifdOffset, true);

  // IFD entry count
  tiffView.setUint16(ifdOffset, entries.length, true);

  let currentEntryPos = ifdOffset + 2;
  let currentDataPos = dataOffset;

  for (const entry of entries) {
    tiffView.setUint16(currentEntryPos, entry.tag, true);
    tiffView.setUint16(currentEntryPos + 2, entry.type, true);
    tiffView.setUint32(currentEntryPos + 4, entry.count, true);

    if (typeof entry.data === 'number') {
      tiffView.setUint32(currentEntryPos + 8, entry.data, true);
    } else if (entry.data.length <= 4) {
      tiffBuffer.set(entry.data, currentEntryPos + 8);
    } else {
      tiffView.setUint32(currentEntryPos + 8, currentDataPos, true);
      tiffBuffer.set(entry.data, currentDataPos);
      currentDataPos += entry.data.length + (entry.data.length % 2);
    }
    currentEntryPos += 12;
  }

  // Next IFD = 0
  tiffView.setUint32(currentEntryPos, 0, true);

  // Wrap in APP1 Exif segment
  const exifHeader = encoder.encode('Exif\0\0');
  const payloadLen = exifHeader.length + tiffBuffer.length;
  const markerLen = 2 + payloadLen;

  if (markerLen > 65535) return new Uint8Array(0);

  const app1 = new Uint8Array(2 + markerLen);
  app1[0] = 0xff;
  app1[1] = 0xe1; // APP1
  app1[2] = (markerLen >> 8) & 0xff;
  app1[3] = markerLen & 0xff;
  app1.set(exifHeader, 4);
  app1.set(tiffBuffer, 4 + exifHeader.length);

  return app1;
}

/**
 * Embeds metadata into an existing JPEG file without re-encoding pixels.
 */
export function embedJpegMetadata(
  jpegBytes: Uint8Array,
  metadata: { title: string; description?: string; keywords: string[] }
): Uint8Array {
  if (jpegBytes[0] !== 0xff || jpegBytes[1] !== 0xd8) {
    throw new Error('Invalid JPEG: SOI marker (0xFFD8) not found');
  }

  const title = (metadata.title || '').trim();
  const description = (metadata.description || title).trim();
  const keywords = metadata.keywords || [];

  const xmpPacket = buildXmpPacket(title, description, keywords);
  const xmpSegment = buildJpegXmpSegment(xmpPacket);
  const iptcSegment = buildJpegIptcSegment(title, description, keywords);
  const exifSegment = buildJpegExifSegment(title, description, keywords);

  // Scan JPEG marker segments
  let pos = 2;
  const segments: Uint8Array[] = [];
  let app0Segment: Uint8Array | null = null;
  let scanStart = -1;

  while (pos < jpegBytes.length) {
    if (jpegBytes[pos] !== 0xff) {
      pos++;
      continue;
    }
    const marker = jpegBytes[pos + 1];

    if (marker === 0xd8) {
      // SOI
      pos += 2;
      continue;
    }
    if (marker === 0xd9) {
      // EOI
      break;
    }
    if (marker === 0xda) {
      // SOS (Start of Scan) - Entropy-coded pixel data begins here
      scanStart = pos;
      break;
    }
    if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7)) {
      // Restart markers or byte stuffing
      pos += 2;
      continue;
    }

    // Segment with 2-byte length
    if (pos + 3 >= jpegBytes.length) break;
    const len = (jpegBytes[pos + 2] << 8) | jpegBytes[pos + 3];
    const segmentBytes = jpegBytes.slice(pos, pos + 2 + len);

    const isApp0 = marker === 0xe0;
    const isApp1 = marker === 0xe1;
    const isApp13 = marker === 0xed;

    let skip = false;

    if (isApp0 && !app0Segment) {
      app0Segment = segmentBytes;
      skip = true;
    } else if (isApp1) {
      // Check for XMP or Exif
      const sliceStr = String.fromCharCode(...segmentBytes.slice(4, 33));
      if (sliceStr.startsWith('http://ns.adobe.com/xap/1.0/\0') || sliceStr.startsWith('Exif\0\0')) {
        skip = true; // Replace with updated metadata
      }
    } else if (isApp13) {
      // Check for Photoshop IPTC
      const sliceStr = String.fromCharCode(...segmentBytes.slice(4, 18));
      if (sliceStr.startsWith('Photoshop 3.0\0')) {
        skip = true; // Replace with updated IPTC
      }
    }

    if (!skip) {
      segments.push(segmentBytes);
    }

    pos += 2 + len;
  }

  // Reassemble: SOI + (APP0) + EXIF + XMP + IPTC + other headers + Pixel Scan Data
  const outParts: Uint8Array[] = [new Uint8Array([0xff, 0xd8])];
  if (app0Segment) outParts.push(app0Segment);
  if (exifSegment && exifSegment.length > 0) outParts.push(exifSegment);
  if (xmpSegment && xmpSegment.length > 0) outParts.push(xmpSegment);
  if (iptcSegment && iptcSegment.length > 0) outParts.push(iptcSegment);

  for (const seg of segments) {
    outParts.push(seg);
  }

  if (scanStart !== -1) {
    outParts.push(jpegBytes.slice(scanStart));
  }

  const totalLen = outParts.reduce((acc, p) => acc + p.length, 0);
  const result = new Uint8Array(totalLen);
  let writePos = 0;
  for (const p of outParts) {
    result.set(p, writePos);
    writePos += p.length;
  }
  return result;
}

/**
 * Embeds metadata into an existing PNG file using an iTXt XMP chunk without re-encoding pixels.
 */
export function embedPngMetadata(
  pngBytes: Uint8Array,
  metadata: { title: string; description?: string; keywords: string[] }
): Uint8Array {
  // Validate 8-byte PNG header: 137 80 78 71 13 10 26 10
  const pngSig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) {
    if (pngBytes[i] !== pngSig[i]) {
      throw new Error('Invalid PNG: signature header not found');
    }
  }

  const title = (metadata.title || '').trim();
  const description = (metadata.description || title).trim();
  const keywords = metadata.keywords || [];

  const xmpPacket = buildXmpPacket(title, description, keywords);
  const encoder = new TextEncoder();

  // Create iTXt chunk:
  // Keyword: "XML:com.adobe.xmp\0"
  // Compression flag: 0 (uncompressed)
  // Compression method: 0
  // Language tag: \0 (empty)
  // Translated keyword: \0 (empty)
  // Text: XMP packet UTF-8
  const keywordBytes = encoder.encode('XML:com.adobe.xmp\0');
  const flags = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
  const textBytes = encoder.encode(xmpPacket);

  const chunkData = new Uint8Array(keywordBytes.length + flags.length + textBytes.length);
  chunkData.set(keywordBytes, 0);
  chunkData.set(flags, keywordBytes.length);
  chunkData.set(textBytes, keywordBytes.length + flags.length);

  // Chunk Type: "iTXt"
  const itxtType = encoder.encode('iTXt');
  const itxtLen = chunkData.length;

  // CRC-32 calculated over Type + Data
  const crcBuf = new Uint8Array(4 + chunkData.length);
  crcBuf.set(itxtType, 0);
  crcBuf.set(chunkData, 4);
  const itxtCrc = crc32(crcBuf);

  // Full Chunk: Length (4) + Type (4) + Data + CRC (4)
  const fullItxtChunk = new Uint8Array(4 + 4 + chunkData.length + 4);
  const view = new DataView(fullItxtChunk.buffer);
  view.setUint32(0, itxtLen, false);
  fullItxtChunk.set(itxtType, 4);
  fullItxtChunk.set(chunkData, 8);
  view.setUint32(8 + chunkData.length, itxtCrc, false);

  // Parse existing PNG chunks and insert our iTXt immediately after IHDR
  let pos = 8;
  const outChunks: Uint8Array[] = [pngBytes.slice(0, 8)];
  let inserted = false;

  while (pos < pngBytes.length) {
    if (pos + 8 > pngBytes.length) break;
    const chunkLen = new DataView(pngBytes.buffer, pngBytes.byteOffset + pos, 4).getUint32(0, false);
    const chunkType = String.fromCharCode(...pngBytes.slice(pos + 4, pos + 8));
    const totalChunkLen = 4 + 4 + chunkLen + 4;
    const chunkBytes = pngBytes.slice(pos, pos + totalChunkLen);

    // Skip any prior XMP iTXt chunks
    if (chunkType === 'iTXt') {
      const sliceKw = String.fromCharCode(...chunkBytes.slice(8, 8 + keywordBytes.length));
      if (sliceKw.startsWith('XML:com.adobe.xmp\0')) {
        pos += totalChunkLen;
        continue;
      }
    }

    outChunks.push(chunkBytes);

    if (chunkType === 'IHDR' && !inserted) {
      outChunks.push(fullItxtChunk);
      inserted = true;
    }

    pos += totalChunkLen;
  }

  if (!inserted) {
    // If IHDR was somehow missed, insert before the last chunk (IEND)
    outChunks.splice(outChunks.length - 1, 0, fullItxtChunk);
  }

  const totalLen = outChunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(totalLen);
  let writePos = 0;
  for (const c of outChunks) {
    result.set(c, writePos);
    writePos += c.length;
  }
  return result;
}

/**
 * Checks whether a given filename / mimeType is compatible with direct metadata embedding.
 */
export function isMetadataEmbeddable(filename: string, mimeType?: string): 'jpeg' | 'png' | null {
  const name = (filename || '').toLowerCase();
  const mime = (mimeType || '').toLowerCase();

  if (name.endsWith('.jpg') || name.endsWith('.jpeg') || mime === 'image/jpeg' || mime === 'image/jpg') {
    return 'jpeg';
  }
  if (name.endsWith('.png') || mime === 'image/png') {
    return 'png';
  }
  return null;
}
