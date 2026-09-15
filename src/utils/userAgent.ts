import { Request } from 'express';
import UAParser from 'ua-parser-js';

export function parseUserAgent(ua: string) {
  const parser = new UAParser(ua);
  const result = parser.getResult();
  return {
    browser: result.browser.name ?? 'Unknown',
    os: result.os.name ?? 'Unknown',
    device: result.device.type ?? 'Desktop',
  };
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress ?? '0.0.0.0';
}
