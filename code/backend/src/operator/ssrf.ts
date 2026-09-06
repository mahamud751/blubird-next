import { lookup } from 'dns/promises';
import ipaddr from 'ipaddr.js';
import { AppError } from '../common/errors';

const BLOCKED_HOSTS = new Set([
  'metadata.google.internal',
  'metadata.goog',
  '169.254.169.254',
  'metadata.aws.internal',
]);

function fail(message: string, details: Record<string, unknown> = {}): never {
  throw new AppError('URL_FORBIDDEN', message, 400, details);
}

function hostOf(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    fail('URL is missing a host');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    fail('only http and https URLs can be imported', { scheme: parsed.protocol.replace(':', '') });
  }
  if (parsed.username || parsed.password) {
    fail('URLs with credentials are not allowed');
  }
  if (!parsed.hostname) fail('URL is missing a host');
  return parsed.hostname.toLowerCase().replace(/\.$/, '');
}

function ipBlocked(ip: ipaddr.IPv4 | ipaddr.IPv6): boolean {
  const range = ip.range();
  if (
    range === 'private' ||
    range === 'loopback' ||
    range === 'linkLocal' ||
    range === 'multicast' ||
    range === 'reserved' ||
    range === 'unspecified' ||
    range === 'carrierGradeNat' ||
    range === 'uniqueLocal'
  ) {
    return true;
  }
  const kind = ip.kind();
  if (kind === 'ipv4') {
    const v4 = ip as ipaddr.IPv4;
    // 169.254.0.0/16 already covered by linkLocal; keep explicit metadata check
    if (v4.match(ipaddr.parseCIDR('169.254.0.0/16'))) return true;
  }
  if (kind === 'ipv6') {
    const v6 = ip as ipaddr.IPv6;
    if (v6.match(ipaddr.parseCIDR('fd00::/8'))) return true;
  }
  return false;
}

function allowlisted(host: string, allowedHosts: Set<string>): boolean {
  if (!allowedHosts.has(host)) return false;
  if (ipaddr.isValid(host)) {
    const ip = ipaddr.parse(host);
    return ip.range() === 'loopback';
  }
  return true;
}

export async function assertUrlAllowed(url: string, allowedHosts: Set<string>): Promise<string> {
  const host = hostOf(url);
  if (BLOCKED_HOSTS.has(host)) fail('this host cannot be imported', { host });
  if (ipaddr.isValid(host)) {
    const ip = ipaddr.parse(host);
    if (ipBlocked(ip) && !allowlisted(host, allowedHosts)) {
      fail('refusing to fetch a private or link-local address', { host });
    }
    if (ip.range() === 'linkLocal' || host === '169.254.169.254') {
      fail('refusing to fetch a link-local or metadata address', { host });
    }
    return url;
  }
  if (allowlisted(host, allowedHosts)) return url;
  let records: { address: string; family: number }[];
  try {
    records = await lookup(host, { all: true });
  } catch {
    fail('could not resolve host', { host });
  }
  for (const rec of records) {
    const ip = ipaddr.parse(rec.address);
    if (ipBlocked(ip)) fail('host resolves to a private address', { host, ip: rec.address });
  }
  return url;
}
