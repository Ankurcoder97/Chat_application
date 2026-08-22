import { describe, it, expect } from 'vitest';
import { AuthService } from './auth.service';

describe('AuthService Token Validation', () => {
  const service = new AuthService();

  it('should generate and verify valid access tokens', () => {
    const payload = {
      userId: '65cbfa123456789012345678',
      email: 'alex@example.com',
      username: 'alex',
    };

    // Use internal generate via any or test verify
    const token = (service as any).generateAccessToken(payload);
    expect(token).toBeDefined();

    const decoded = service.verifyAccessToken(token);
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.email).toBe(payload.email);
    expect(decoded.username).toBe(payload.username);
  });

  it('should throw UnauthorizedError on malformed access token', () => {
    expect(() => service.verifyAccessToken('invalid.token.here')).toThrow();
  });
});
