import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface AuthTokenPayload {
  sub: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  generateToken(userId: string): string {
    if (!userId.trim()) {
      throw new Error('userId is required');
    }

    return this.jwtService.sign({
      sub: userId,
    });
  }

  verifyToken(token: string): AuthTokenPayload {
    try {
      return this.jwtService.verify<AuthTokenPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}