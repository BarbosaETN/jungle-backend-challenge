import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const jwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  } as unknown as JwtService;

  let authService: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    authService = new AuthService(jwtService);
  });

  it('should generate a JWT for a valid user id', () => {
    jwtService.sign = jest.fn().mockReturnValue('jwt-token');

    const token = authService.generateToken('player-123');

    expect(token).toBe('jwt-token');
    expect(jwtService.sign).toHaveBeenCalledWith({
      sub: 'player-123',
    });
  });

  it('should reject an empty user id', () => {
    expect(() => authService.generateToken('')).toThrow(
      'userId is required',
    );
  });

  it('should verify a valid JWT', () => {
    jwtService.verify = jest.fn().mockReturnValue({
      sub: 'player-123',
    });

    const payload = authService.verifyToken('valid-token');

    expect(payload).toEqual({
      sub: 'player-123',
    });

    expect(jwtService.verify).toHaveBeenCalledWith('valid-token');
  });

  it('should throw UnauthorizedException for an invalid JWT', () => {
    jwtService.verify = jest.fn().mockImplementation(() => {
      throw new Error('Invalid token');
    });

    expect(() => authService.verifyToken('invalid-token')).toThrow(
      UnauthorizedException,
    );
  });
});