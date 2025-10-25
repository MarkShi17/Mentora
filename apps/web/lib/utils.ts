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
  // Use UTC to avoid server/client timezone mismatch
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes.toString().padStart(2, '0');
  return `${displayHours}:${displayMinutes} ${ampm}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
