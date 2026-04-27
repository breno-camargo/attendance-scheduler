import { NextResponse } from 'next/server';

import { getClientIp } from '@/lib/api-utils';
import { checkCspReportRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const MAX_REPORT_BYTES = 10 * 1024;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value.slice(0, 500) : undefined;
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const allowed = await checkCspReportRateLimit(ip);
  if (!allowed) {
    return new NextResponse(null, { status: 204 });
  }

  const contentLength = Number(request.headers.get('content-length') || '0');
  if (contentLength > MAX_REPORT_BYTES) {
    return new NextResponse(null, { status: 204 });
  }

  try {
    const payload = asRecord(await request.json());
    const report = asRecord(payload['csp-report'] ?? payload);
    const entry = {
      timestamp: new Date().toISOString(),
      ip,
      documentUri: asString(report['document-uri']),
      blockedUri: asString(report['blocked-uri']),
      violatedDirective: asString(report['violated-directive']),
      effectiveDirective: asString(report['effective-directive']),
      sourceFile: asString(report['source-file']),
      lineNumber: report['line-number'],
    };

    console.warn(`[CSP_REPORT] ${JSON.stringify(entry)}`);
  } catch {
    // Relatórios CSP não devem afetar navegação do usuário.
  }

  return new NextResponse(null, { status: 204 });
}
