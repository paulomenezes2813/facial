import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, senha: string) {
    const user = await this.prisma.adminUser.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (!user || !user.ativo) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    const ok = await argon2.verify(user.senhaHash, senha);
    if (!ok) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    const token = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      type: 'admin' as const,
    });
    return {
      token,
      user: { id: user.id, email: user.email, nome: user.nome },
    };
  }

  static hashPassword(plaintext: string) {
    return argon2.hash(plaintext);
  }
}
