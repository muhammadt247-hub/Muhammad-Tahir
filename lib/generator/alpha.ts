// Sample canvas pixels to detect whether a PNG image has transparency (alpha < 255)
export function detectImageAlpha(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  try {
    // For performance on large images, sample a grid of pixels
    const sampleStep = Math.max(1, Math.floor(Math.min(width, height) / 40));
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    for (let y = 0; y < height; y += sampleStep) {
      for (let x = 0; x < width; x += sampleStep) {
        const index = (y * width + x) * 4 + 3; // alpha channel
        if (data[index] < 250) {
          return true; // Found transparent or semi-transparent pixel
        }
      }
    }
    return false;
  } catch {
    return false;
  }
}
