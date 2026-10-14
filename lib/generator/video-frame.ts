// Extract a video frame at 1s or 10% duration using an offscreen video element
export async function extractVideoFrame(file: File): Promise<{
  frameDataUrl: string;
  width: number;
  height: number;
}> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const url = URL.createObjectURL(file);
    video.src = url;

    let seeked = false;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.remove();
    };

    video.onloadedmetadata = () => {
      // Seek to 1 second or 10% of duration
      const targetTime = Math.min(1.0, video.duration > 0 ? video.duration * 0.1 : 0.5);
      video.currentTime = targetTime;
    };

    video.onseeked = () => {
      if (seeked) return;
      seeked = true;

      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 360;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup();
          return reject(new Error('Canvas 2D context not available'));
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frameDataUrl = canvas.toDataURL('image/jpeg', 0.85);

        cleanup();
        resolve({
          frameDataUrl,
          width: canvas.width,
          height: canvas.height,
        });
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    video.onerror = () => {
      cleanup();
      reject(new Error(`Failed to load video: ${file.name}`));
    };

    // Timeout safety
    setTimeout(() => {
      if (!seeked) {
        cleanup();
        reject(new Error(`Video frame extraction timed out for ${file.name}`));
      }
    }, 10000);
  });
}
