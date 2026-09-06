export type ImageMatch = { id: number; score: number };

async function signature(source: File | string): Promise<number[]> {
  const url = typeof source === "string" ? source : URL.createObjectURL(source);
  try {
    const image = new Image(); image.crossOrigin = "anonymous"; image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = 24; canvas.height = 24;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Image analysis is not available in this browser.");
    context.drawImage(image, 0, 0, 24, 24);
    const data = context.getImageData(0, 0, 24, 24).data;
    const bins = new Array(48).fill(0) as number[];
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 80) continue;
      const r = Math.min(3, Math.floor(data[i] / 64)); const g = Math.min(3, Math.floor(data[i + 1] / 64)); const b = Math.min(2, Math.floor(data[i + 2] / 86));
      bins[r * 12 + g * 3 + b] += 1;
    }
    const total = bins.reduce((sum, value) => sum + value, 0) || 1;
    return bins.map((value) => value / total);
  } finally { if (typeof source !== "string") URL.revokeObjectURL(url); }
}

export async function findVisualMatches(file: File, products: { id: number; image_url: string }[]): Promise<ImageMatch[]> {
  const target = await signature(file);
  const matches = await Promise.all(products.map(async (product) => {
    try {
      const sample = await signature(product.image_url);
      const distance = target.reduce((sum, value, index) => sum + Math.abs(value - sample[index]), 0);
      return { id: product.id, score: Math.max(0, 1 - distance / 2) };
    } catch { return { id: product.id, score: 0 }; }
  }));
  return matches.sort((a, b) => b.score - a.score);
}
