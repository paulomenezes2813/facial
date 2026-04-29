import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import type { JwtPayload } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() body: { email: string; senha: string }) {
    return this.auth.login(body.email, body.senha);
  }

  @Get('me')
  me(@Req() req: Request & { user?: JwtPayload }) {
    return req.user;
  }
}
