export function nanoid(size = 10): string {
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
  let id = "";
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const randomValues = crypto.getRandomValues(new Uint8Array(size));
    for (let i = 0; i < size; i += 1) {
      id += alphabet[randomValues[i] % alphabet.length];
    }
    return id;
  }
  for (let i = 0; i < size; i += 1) {
    id += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return id;
}

export function formatTime(timeIso: string): string {
  const date = new Date(timeIso);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
