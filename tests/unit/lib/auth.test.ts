import bcrypt from 'bcryptjs';
import { describe, it, expect } from 'vitest';

describe('auth password verification', () => {
  it('should verify correct password against bcrypt hash', async () => {
    const password = 'test-password-123';
    const hash = await bcrypt.hash(password, 12);
    const result = await bcrypt.compare(password, hash);
    expect(result).toBe(true);
  });

  it('should reject wrong password against bcrypt hash', async () => {
    const hash = await bcrypt.hash('correct-password', 12);
    const result = await bcrypt.compare('wrong-password', hash);
    expect(result).toBe(false);
  });

  it('should generate different hashes for same password', async () => {
    const password = 'same-password';
    const hash1 = await bcrypt.hash(password, 12);
    const hash2 = await bcrypt.hash(password, 12);
    expect(hash1).not.toBe(hash2);
    expect(await bcrypt.compare(password, hash1)).toBe(true);
    expect(await bcrypt.compare(password, hash2)).toBe(true);
  });
});
