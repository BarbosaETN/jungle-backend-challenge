import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const authService = {
    verifyToken: jest.fn(),
  } as unknown as AuthService;

  let guard: JwtAuthGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new JwtAuthGuard(authService);
  });

  function createExecutionContext(authorization?: string): ExecutionContext {
    const request = {
      headers: {
        authorization,
      },
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  it('should reject a request without authorization header', () => {
    const context = createExecutionContext();

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);

    expect(authService.verifyToken).not.toHaveBeenCalled();
  });

  it('should reject a malformed authorization header', () => {
    const context = createExecutionContext('Basic abc123');

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);

    expect(authService.verifyToken).not.toHaveBeenCalled();
  });

  it('should reject an authorization header without token', () => {
    const context = createExecutionContext('Bearer');

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);

    expect(authService.verifyToken).not.toHaveBeenCalled();
  });

  it('should reject an invalid token', () => {
    authService.verifyToken = jest.fn().mockImplementation(() => {
      throw new UnauthorizedException('Invalid or expired token');
    });

    const context = createExecutionContext('Bearer invalid-token');

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);

    expect(authService.verifyToken).toHaveBeenCalledWith('invalid-token');
  });

  it('should allow a valid token and attach the payload to the request', () => {
    const payload = {
      sub: 'player-123',
    };

    authService.verifyToken = jest.fn().mockReturnValue(payload);

    const request: {
      headers: {
        authorization: string;
      };
      user?: {
        sub: string;
      };
    } = {
      headers: {
        authorization: 'Bearer valid-token',
      },
    };
    
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;

    const result = guard.canActivate(context);

    expect(result).toBe(true);
    expect(authService.verifyToken).toHaveBeenCalledWith('valid-token');
    expect(request.user).toEqual(payload);
  });
});
