export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 9);
  return `${prefix}_${timestamp}${randomStr}`;
}

export function generateSessionId(): string {
  return generateId('session');
}

export function generateTurnId(): string {
  return generateId('turn');
}

export function generateObjectId(): string {
  return generateId('obj');
}
