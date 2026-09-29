// Uploads many picked files, a few at a time, and hands back the results
// in the order they were picked (not the order they finished) plus the
// ones that failed — shared by every "pick several photos" field in the
// admin (landing gallery block, the event page's photo carousel, the
// homepage gallery).
export async function uploadMany<T>(
  files: File[],
  uploadOne: (file: File) => Promise<{ ok: true; value: T } | { ok: false; error: string }>,
  onProgress: (done: number, total: number) => void,
  concurrency = 3
): Promise<{ values: T[]; failed: string[] }> {
  const results: (T | undefined)[] = new Array(files.length).fill(undefined);
  const failed: string[] = [];
  let next = 0;
  let done = 0;
  async function worker() {
    while (next < files.length) {
      const index = next++;
      const file = files[index]!;
      const result = await uploadOne(file).catch(() => ({ ok: false as const, error: "No se pudo subir la imagen." }));
      if (result.ok) results[index] = result.value;
      else failed.push(`${file.name}: ${result.error}`);
      done += 1;
      onProgress(done, files.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, worker));
  return { values: results.filter((r): r is T => r !== undefined), failed };
}
