// Rasterize an SVG file into a 1600 px wide PNG on a white background using an HTML5 canvas.
// Uses width/height or viewBox, handles missing fonts with fallbacks, and caps the size.

export async function rasterizeSvgToPng(file: File): Promise<{
  pngDataUrl: string;
  width: number;
  height: number;
}> {
  if (file.size > 100 * 1024 * 1024) {
    throw new Error('SVG file exceeds the 100 MB size limit.');
  }

  const text = await file.text();

  // Parse SVG to extract viewBox or width/height and inject font fallback
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'image/svg+xml');

  // Check for XML parse errors
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error(
      `SVG XML syntax error: ${parserError.textContent?.slice(0, 120) || 'Malformed XML structure'}`
    );
  }

  const svgEl = doc.querySelector('svg');
  if (!svgEl) {
    throw new Error('Invalid SVG: No <svg> root element found.');
  }

  // Handle missing fonts with fallbacks
  const styleEl = doc.createElementNS('http://www.w3.org/2000/svg', 'style');
  styleEl.textContent = `
    * {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
    }
  `;
  svgEl.insertBefore(styleEl, svgEl.firstChild);

  // Extract dimensions
  let naturalW = parseFloat(svgEl.getAttribute('width') || '0');
  let naturalH = parseFloat(svgEl.getAttribute('height') || '0');

  const viewBox = svgEl.getAttribute('viewBox');
  let vbW = 0;
  let vbH = 0;
  if (viewBox) {
    const parts = viewBox.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      vbW = parts[2];
      vbH = parts[3];
    }
  }

  if (naturalW <= 0 || isNaN(naturalW)) naturalW = vbW || 1600;
  if (naturalH <= 0 || isNaN(naturalH)) naturalH = vbH || 1600;

  // Rasterize to 1600 px wide
  let targetWidth = 1600;
  let targetHeight = Math.round((naturalH / naturalW) * targetWidth);
  if (isNaN(targetHeight) || targetHeight <= 0) targetHeight = 1600;

  // Cap size: max height 3200 px, min 100 px
  if (targetHeight > 3200) {
    targetHeight = 3200;
    targetWidth = Math.max(100, Math.round((naturalW / naturalH) * targetHeight));
  }
  if (targetWidth > 3200) {
    targetWidth = 3200;
  }

  svgEl.setAttribute('width', `${targetWidth}px`);
  svgEl.setAttribute('height', `${targetHeight}px`);

  const serialized = new XMLSerializer().serializeToString(doc);
  const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Canvas 2D context not available'));
      }

      // Draw SVG on white background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, targetWidth, targetHeight);
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      const pngDataUrl = canvas.toDataURL('image/png');
      resolve({
        pngDataUrl,
        width: targetWidth,
        height: targetHeight,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to rasterize SVG image: ${file.name}`));
    };

    img.src = url;
  });
}
