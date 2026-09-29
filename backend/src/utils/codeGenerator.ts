/**
 * Derives a short, human-readable code from a name (e.g. "ABC Technologies"
 * -> "ABC", "Hyderabad Business Tower" -> "HBT"), then appends a numeric
 * suffix until `isTaken` reports the candidate is free. Used so project and
 * company codes can be auto-generated instead of asked for on the form.
 */
export async function generateUniqueCode(
  name: string,
  isTaken: (code: string) => Promise<boolean>
): Promise<string> {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  let base: string;
  if (words.length >= 2) {
    base = words
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 6);
  } else {
    base = (words[0] ?? "CO").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6);
  }
  base = base.replace(/[^A-Z0-9]/g, "") || "CO";

  if (!(await isTaken(base))) return base;

  for (let suffix = 1; suffix <= 9999; suffix++) {
    const candidate = `${base}${String(suffix).padStart(3, "0")}`;
    if (!(await isTaken(candidate))) return candidate;
  }

  // Astronomically unlikely fallback.
  return `${base}${Date.now().toString(36).toUpperCase()}`;
}
