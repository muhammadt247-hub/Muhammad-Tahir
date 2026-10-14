/**
 * Perceptual Hash (dHash - Difference Hash) 64-bit implementation
 * for client-side near-duplicate detection in browser.
 */

export interface DuplicateGroup {
  groupId: string;
  leadItemId: string;
  itemIds: string[];
  maxDistance: number;
}

/**
 * Computes 64-bit dHash of an image URL or Blob using HTML5 Canvas.
 * Resizes to 9x8, converts to grayscale, and compares adjacent pixels.
 */
export async function computeDHash(imageSource: string | Blob): Promise<string> {
  if (typeof window === 'undefined') return '';

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    let objectUrl = '';
    if (imageSource instanceof Blob) {
      objectUrl = URL.createObjectURL(imageSource);
      img.src = objectUrl;
    } else {
      img.src = imageSource;
    }

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 9;
        canvas.height = 8;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          return resolve('');
        }

        ctx.drawImage(img, 0, 0, 9, 8);
        const imgData = ctx.getImageData(0, 0, 9, 8).data;

        // Convert to 9x8 grayscale
        const gray: number[][] = [];
        for (let y = 0; y < 8; y++) {
          gray[y] = [];
          for (let x = 0; x < 9; x++) {
            const idx = (y * 9 + x) * 4;
            const r = imgData[idx];
            const g = imgData[idx + 1];
            const b = imgData[idx + 2];
            // Standard luminance formula
            gray[y][x] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
          }
        }

        // Compute 64-bit binary string (8 rows x 8 comparisons)
        let binaryStr = '';
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 8; x++) {
            binaryStr += gray[y][x] > gray[y][x + 1] ? '1' : '0';
          }
        }

        if (objectUrl) URL.revokeObjectURL(objectUrl);

        // Convert binary string to 16 hex characters
        let hexStr = '';
        for (let i = 0; i < 64; i += 4) {
          const nibble = binaryStr.substring(i, i + 4);
          hexStr += parseInt(nibble, 2).toString(16);
        }

        resolve(hexStr);
      } catch (err) {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        console.error('Failed to compute dHash:', err);
        resolve('');
      }
    };

    img.onerror = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      resolve('');
    };
  });
}

/**
 * Calculates Hamming distance between two 64-bit hex hash strings.
 */
export function hammingDistance(hash1: string, hash2: string): number {
  if (!hash1 || !hash2 || hash1.length !== hash2.length) return 64;

  let dist = 0;
  for (let i = 0; i < hash1.length; i++) {
    const n1 = parseInt(hash1[i], 16);
    const n2 = parseInt(hash2[i], 16);
    let xor = n1 ^ n2;
    while (xor > 0) {
      dist += xor & 1;
      xor >>= 1;
    }
  }
  return dist;
}

/**
 * Groups items whose perceptual hashes are within maxDistance (default: 6 bits)
 */
export function groupNearDuplicates<T extends { id: string; dhash?: string }>(
  items: T[],
  maxDistance = 6
): DuplicateGroup[] {
  const validItems = items.filter((it) => it.dhash && it.dhash.length === 16);
  if (validItems.length < 2) return [];

  const visited = new Set<string>();
  const groups: DuplicateGroup[] = [];

  for (let i = 0; i < validItems.length; i++) {
    const itemA = validItems[i];
    if (visited.has(itemA.id)) continue;

    const cluster: string[] = [itemA.id];
    let maxGroupDist = 0;

    for (let j = i + 1; j < validItems.length; j++) {
      const itemB = validItems[j];
      if (visited.has(itemB.id)) continue;

      const dist = hammingDistance(itemA.dhash!, itemB.dhash!);
      if (dist <= maxDistance) {
        cluster.push(itemB.id);
        visited.add(itemB.id);
        if (dist > maxGroupDist) maxGroupDist = dist;
      }
    }

    if (cluster.length > 1) {
      visited.add(itemA.id);
      groups.push({
        groupId: `group_${itemA.id}`,
        leadItemId: itemA.id,
        itemIds: cluster,
        maxDistance: maxGroupDist,
      });
    }
  }

  return groups;
}
