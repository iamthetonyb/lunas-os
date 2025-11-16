import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  requireUser,
  requireRole,
  UnauthorizedError,
  ForbiddenError,
} from '../../lib/auth/guards';
import { auth } from '../../auth';

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}));

const mockedAuth = vi.mocked(auth);

describe('auth guards', () => {
  beforeEach(() => {
    mockedAuth.mockReset();
  });

  it('throws UnauthorizedError when session missing', async () => {
    mockedAuth.mockResolvedValue(null);
    await expect(requireUser()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('returns user when session is valid', async () => {
    mockedAuth.mockResolvedValue({
      user: { id: 'user-1', orgId: 'org-1', role: 'admin', name: 'Test' },
    } as any);
    await expect(requireUser()).resolves.toMatchObject({ id: 'user-1', orgId: 'org-1' });
  });

  it('throws ForbiddenError when role mismatch', async () => {
    mockedAuth.mockResolvedValue({
      user: { id: 'user-1', orgId: 'org-1', role: 'contractor' },
    } as any);
    await expect(requireRole('admin')).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('allows matching roles', async () => {
    mockedAuth.mockResolvedValue({
      user: { id: 'user-1', orgId: 'org-1', role: 'backoffice' },
    } as any);
    await expect(requireRole(['admin', 'backoffice'])).resolves.toMatchObject({
      id: 'user-1',
      role: 'backoffice',
    });
  });
});
