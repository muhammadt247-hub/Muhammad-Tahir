// Rasterize an SVG file into a 1024px PNG data URI via an HTML5 canvas
export async function rasterizeSvgToPng(file: File): Promise<{
  pngDataUrl: string;
  width: number;
  height: number;
}> {
  const text = await file.text();
  const blob = new Blob([text], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);

      const maxDim = 1024;
      let width = img.naturalWidth || 1024;
      let height = img.naturalHeight || 1024;

      if (width > maxDim || height > maxDim) {
        if (width >= height) {
          height = Math.round((height / width) * maxDim);
          width = maxDim;
        } else {
          width = Math.round((width / height) * maxDim);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Canvas 2D context not available'));
      }

      // Draw SVG on white background for the AI request
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      const pngDataUrl = canvas.toDataURL('image/png');
      resolve({
        pngDataUrl,
        width,
        height,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to rasterize SVG: ${file.name}`));
    };

    img.src = url;
  });
}
