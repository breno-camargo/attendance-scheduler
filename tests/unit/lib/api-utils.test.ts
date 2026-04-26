/* eslint-disable import/order -- vi.mock must precede imports */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock NextResponse
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data, opts) => ({ data, status: opts?.status || 200 })),
  },
}));

// Mock next-auth
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

// Mock auth options
vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));
import { getServerSession } from 'next-auth';
import { ApiUtils, requireAuth, requireAuthWithScope } from '@/lib/api-utils';
/* eslint-enable import/order */

// ─────────────────────────────────────────────
// capitalizeName
// ─────────────────────────────────────────────
describe('ApiUtils.capitalizeName', () => {
  it('returns empty string for empty input', () => {
    expect(ApiUtils.capitalizeName('')).toBe('');
  });

  it('returns empty string for falsy input (undefined cast to empty)', () => {
    // The implementation checks `if (!name) return ""`, so passing undefined-ish
    // values should still be safe via the type (but we test the falsy guard)
    expect(ApiUtils.capitalizeName('')).toBe('');
  });

  it('capitalizes a simple single word', () => {
    expect(ApiUtils.capitalizeName('john')).toBe('John');
  });

  it('capitalizes each word in a normal name', () => {
    expect(ApiUtils.capitalizeName('maria silva')).toBe('Maria Silva');
  });

  it('preserves preposition "de" in lowercase when not first word', () => {
    expect(ApiUtils.capitalizeName('joao de souza')).toBe('Joao de Souza');
  });

  it('preserves preposition "do" in lowercase when not first word', () => {
    expect(ApiUtils.capitalizeName('pedro do vale')).toBe('Pedro do Vale');
  });

  it('preserves preposition "da" in lowercase when not first word', () => {
    expect(ApiUtils.capitalizeName('ana da silva')).toBe('Ana da Silva');
  });

  it('preserves preposition "dos" in lowercase when not first word', () => {
    expect(ApiUtils.capitalizeName('carlos dos santos')).toBe('Carlos dos Santos');
  });

  it('preserves preposition "das" in lowercase when not first word', () => {
    expect(ApiUtils.capitalizeName('lucia das neves')).toBe('Lucia das Neves');
  });

  it('preserves conjunction "e" in lowercase when not first word', () => {
    expect(ApiUtils.capitalizeName('maria e joao')).toBe('Maria e Joao');
  });

  it('capitalizes first word even if it is a preposition', () => {
    // index === 0, so preposition check does not apply
    expect(ApiUtils.capitalizeName('de souza')).toBe('De Souza');
  });

  it('handles multiple consecutive prepositions', () => {
    expect(ApiUtils.capitalizeName('ana de da silva')).toBe('Ana de da Silva');
  });

  it('trims leading/trailing whitespace', () => {
    expect(ApiUtils.capitalizeName('  breno camargo  ')).toBe('Breno Camargo');
  });

  it('normalises input that is already upper-case', () => {
    expect(ApiUtils.capitalizeName('JOAO DO VALE')).toBe('Joao do Vale');
  });

  it('handles a name with mixed case input', () => {
    expect(ApiUtils.capitalizeName('jOsÉ dA sIlVa')).toBe('José da Silva');
  });
});

// ─────────────────────────────────────────────
// maskPII
// ─────────────────────────────────────────────
describe('ApiUtils.maskPII', () => {
  it('returns null as-is', () => {
    expect(ApiUtils.maskPII(null)).toBeNull();
  });

  it('returns undefined as-is', () => {
    expect(ApiUtils.maskPII(undefined)).toBeUndefined();
  });

  it('masks an email string – keeps first char and domain', () => {
    expect(ApiUtils.maskPII('breno@email.com')).toBe('b****@email.com');
  });

  it('masks an email with a single-char local part', () => {
    expect(ApiUtils.maskPII('b@domain.org')).toBe('b****@domain.org');
  });

  it('masks a phone string with 11 digits', () => {
    // digits: 11987654321  → ddd=11, last4=4321
    expect(ApiUtils.maskPII('(11) 98765-4321')).toBe('(11) 9****-4321');
  });

  it('masks a phone string with exactly 10 digits', () => {
    // digits: 1134567890  → ddd=11, last4=7890
    expect(ApiUtils.maskPII('(11) 3456-7890')).toBe('(11) 9****-7890');
  });

  it('does NOT mask a short phone (fewer than 10 digits)', () => {
    // 9 digits – falls through to return val unchanged
    expect(ApiUtils.maskPII('119876543')).toBe('119876543');
  });

  it('masks email field inside an object', () => {
    const result = ApiUtils.maskPII({ email: 'user@test.com', name: 'User' });
    expect(result.email).toBe('u****@test.com');
    expect(result.name).toBe('User');
  });

  it('masks phone field inside an object', () => {
    const result = ApiUtils.maskPII({ phone: '(21) 99999-8888', role: 'admin' });
    expect(result.phone).toBe('(21) 9****-8888');
    expect(result.role).toBe('admin');
  });

  it('masks both email and phone inside an object', () => {
    const result = ApiUtils.maskPII({ email: 'a@b.co', phone: '(11) 91234-5678' });
    expect(result.email).toBe('a****@b.co');
    expect(result.phone).toBe('(11) 9****-5678');
  });

  it('does not mutate the original object', () => {
    const original = { email: 'a@b.co', name: 'Test' };
    ApiUtils.maskPII(original);
    expect(original.email).toBe('a@b.co');
  });

  it('maps over an array of objects and masks each one', () => {
    const list = [
      { email: 'alice@x.com', phone: '(11) 91111-2222' },
      { email: 'bob@y.com', phone: '(21) 93333-4444' },
    ];
    const result = ApiUtils.maskPII(list);
    expect(result[0].email).toBe('a****@x.com');
    expect(result[0].phone).toBe('(11) 9****-2222');
    expect(result[1].email).toBe('b****@y.com');
    expect(result[1].phone).toBe('(21) 9****-4444');
  });

  it('handles an array containing objects without PII fields', () => {
    const list = [{ name: 'No PII' }, { role: 'guest' }];
    const result = ApiUtils.maskPII(list);
    expect(result[0]).toEqual({ name: 'No PII' });
    expect(result[1]).toEqual({ role: 'guest' });
  });

  it('handles nested objects recursively', () => {
    const nested = { email: 'x@y.com', child: { email: 'z@w.com' } };
    const result = ApiUtils.maskPII(nested);
    expect(result.email).toBe('x****@y.com');
    expect(result.child.email).toBe('z****@w.com');
  });

  it('preserves Date objects during recursion', () => {
    const now = new Date();
    const data = { email: 'x@y.com', createdAt: now };
    const result = ApiUtils.maskPII(data);
    expect(result.createdAt).toBe(now);
  });

  it('returns a number value unchanged', () => {
    expect(ApiUtils.maskPII(42)).toBe(42);
  });
});

// ─────────────────────────────────────────────
// formatPhone
// ─────────────────────────────────────────────
describe('ApiUtils.formatPhone', () => {
  it('returns empty string for empty input', () => {
    expect(ApiUtils.formatPhone('')).toBe('');
  });

  it('returns empty string for falsy null-like (empty string)', () => {
    expect(ApiUtils.formatPhone('')).toBe('');
  });

  it('formats a single digit as open paren + digit', () => {
    expect(ApiUtils.formatPhone('1')).toBe('(1');
  });

  it('formats 2 digits as open paren + 2 digits', () => {
    expect(ApiUtils.formatPhone('11')).toBe('(11');
  });

  it('formats 3 digits as (XX) Y', () => {
    expect(ApiUtils.formatPhone('119')).toBe('(11) 9');
  });

  it('formats 7 digits as (XX) XXXXX', () => {
    expect(ApiUtils.formatPhone('1198765')).toBe('(11) 98765');
  });

  it('formats 8 digits as (XX) XXXXX-X', () => {
    expect(ApiUtils.formatPhone('11987654')).toBe('(11) 98765-4');
  });

  it('formats 11 digits as (XX) XXXXX-XXXX', () => {
    expect(ApiUtils.formatPhone('11987654321')).toBe('(11) 98765-4321');
  });

  it('strips non-digit characters before formatting', () => {
    expect(ApiUtils.formatPhone('(11) 98765-4321')).toBe('(11) 98765-4321');
  });

  it('strips letters and symbols', () => {
    expect(ApiUtils.formatPhone('ab11cd98765efgh4321')).toBe('(11) 98765-4321');
  });

  it('truncates input longer than 11 digits to 11', () => {
    expect(ApiUtils.formatPhone('119876543210000')).toBe('(11) 98765-4321');
  });

  it('handles a 10-digit number (fixed line)', () => {
    expect(ApiUtils.formatPhone('1134567890')).toBe('(11) 34567-890');
  });
});

// ─────────────────────────────────────────────
// ApiUtils.success
// ─────────────────────────────────────────────
describe('ApiUtils.success', () => {
  it('returns status 200 by default', () => {
    const res = ApiUtils.success({ ok: true }) as any;
    expect(res.status).toBe(200);
  });

  it('includes the provided data in the response', () => {
    const res = ApiUtils.success({ id: 1, name: 'Test' }) as any;
    expect(res.data).toEqual({ id: 1, name: 'Test' });
  });

  it('uses the custom status when provided', () => {
    const res = ApiUtils.success({ created: true }, 201) as any;
    expect(res.status).toBe(201);
  });

  it('passes through an array as data', () => {
    const res = ApiUtils.success([1, 2, 3]) as any;
    expect(res.data).toEqual([1, 2, 3]);
  });
});

// ─────────────────────────────────────────────
// ApiUtils.error
// ─────────────────────────────────────────────
describe('ApiUtils.error', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('returns status 500 by default', () => {
    const res = ApiUtils.error('Something went wrong') as any;
    expect(res.status).toBe(500);
  });

  it('uses the custom status when provided', () => {
    const res = ApiUtils.error('Not found', null, 404) as any;
    expect(res.status).toBe(404);
  });

  it('includes the error message in response data', () => {
    const res = ApiUtils.error('Bad request', null, 400) as any;
    expect(res.data.error).toBe('Bad request');
  });

  it('in development mode, exposes details in response', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = ApiUtils.error('DB error', { stack: 'at line 42' }) as any;
    expect(res.data.details).toEqual({ stack: 'at line 42' });
  });

  it('in production mode, redacts details with a generic message', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = ApiUtils.error('DB error', { stack: 'secret info' }) as any;
    expect(res.data.details).toBe('Consulte os logs do servidor.');
  });

  it('logs error details to console.error for server errors (>=500) with details', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    ApiUtils.error('Failure', { reason: 'timeout' });
    expect(spy).toHaveBeenCalledWith('[API ERROR 500] Failure:', { reason: 'timeout' });
  });

  it('does NOT call console.error when details are null', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    ApiUtils.error('Failure', null);
    expect(spy).not.toHaveBeenCalled();
  });

  it('does NOT call console.error for client errors (4xx) even with details', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    ApiUtils.error('Dados inválidos', { field: 'name' }, 400);
    ApiUtils.error('Não encontrado', { id: 'abc' }, 404);
    expect(spy).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────
// requireAuth
// ─────────────────────────────────────────────
describe('requireAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when a valid session exists', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { name: 'Alice' } } as any);
    const result = await requireAuth();
    expect(result).toBeNull();
  });

  it('returns a 401 response when there is no session', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const result = (await requireAuth()) as any;
    expect(result).not.toBeNull();
    expect(result.status).toBe(401);
    expect(result.data.error).toBe('Não autorizado');
  });

  it('returns a 401 response when session is undefined', async () => {
    vi.mocked(getServerSession).mockResolvedValue(undefined as any);
    const result = (await requireAuth()) as any;
    expect(result.status).toBe(401);
  });

  it('calls getServerSession with the authOptions', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} } as any);
    await requireAuth();
    expect(getServerSession).toHaveBeenCalledTimes(1);
  });
});

describe('requireAuthWithScope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('denies linked users with unknown roles by default', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { role: 'Analista', internalContactId: 'contact-1' },
    } as any);

    const result = (await requireAuthWithScope()) as any;

    expect(result.error.status).toBe(403);
    expect(result.error.data.error).toBe('Sem permissao');
  });
});
