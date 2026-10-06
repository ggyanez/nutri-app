/** Lowercases and strips accents, so "cafe" finds "Café". */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * How well a name matches what was typed, lower is better: 0 when the name
 * starts with those exact words ("papa" in "Papa hervida"), 1 when it starts
 * with the letters ("Papaya"), 2 when another of its words does, 3 when it's
 * somewhere inside, 4 when only `extra` (brand, other names) has it. Null
 * when some typed word is missing.
 */
export function matchRank(query: string, name: string, extra = ""): number | null {
  const q = normalize(query);
  if (!q) return 0;
  const target = normalize(name);
  const everything = `${target} ${normalize(extra)}`;
  const words = q.split(/\s+/);
  if (!words.every((word) => everything.includes(word))) return null;
  if (target === q || target.startsWith(`${q} `)) return 0;
  if (target.startsWith(q)) return 1;
  if (target.split(/\s+/).some((word) => word.startsWith(words[0]))) return 2;
  if (target.includes(words[0])) return 3;
  return 4;
}

/** The items that match what was typed, best matches first; otherwise in their own order. */
export function searchBy<T>(
  items: T[],
  query: string,
  texts: (item: T) => { name: string; extra?: string },
): T[] {
  if (!normalize(query)) return items;
  return items
    .map((item) => {
      const { name, extra } = texts(item);
      return { item, rank: matchRank(query, name, extra) };
    })
    .filter((x): x is { item: T; rank: number } => x.rank !== null)
    .sort((a, b) => a.rank - b.rank)
    .map((x) => x.item);
}
