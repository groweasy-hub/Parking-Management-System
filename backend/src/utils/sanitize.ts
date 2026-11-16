export function stripHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, "")
    .trim();
}

export function sanitizeEmail(input: string): string {
  return stripHtml(input).replace(/[^\w.!#$%&'*+/=?^`{|}~@-]/g, "").toLowerCase();
}

export function sanitizeHumanName(input: string): string {
  return stripHtml(input).replace(/[^\p{L}\p{N}\s.'_-]/gu, "").replace(/\s+/g, " ").trim();
}

export function sanitizePhone(input: string): string {
  return stripHtml(input).replace(/[^\d+\-\s()]/g, "").replace(/\s+/g, " ").trim();
}

export function phoneLookupPattern(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length < 7) return null;
  return `^\\+?\\D*${digits.split("").join("\\D*")}\\D*$`;
}

export function phoneDigits(input: string): string {
  return input.replace(/\D/g, "");
}

export function sanitizePassword(input: string): string {
  return stripHtml(input).replace(/[\u0000-\u001f\u007f]/g, "");
}

