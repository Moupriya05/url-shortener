const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export function generateShortCode(length = 7): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += BASE62[Math.floor(Math.random() * 62)];
  }
  return result;
}

export function isValidShortCode(code: string): boolean {
  return /^[0-9A-Za-z_-]{3,32}$/.test(code);
}
