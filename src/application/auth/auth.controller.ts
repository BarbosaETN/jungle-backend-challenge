import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

interface GenerateTokenRequest {
  userId: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('token')
  generateToken(@Body() body: GenerateTokenRequest) {
    return {
      accessToken: this.authService.generateToken(body.userId),
    };
  }
}