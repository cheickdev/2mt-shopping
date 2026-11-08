// Transforme un nom en identifiant d'URL (slug).
export function slugify(input: string): string {
  return (input || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // enleve les accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}
