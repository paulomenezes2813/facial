/**
 * Seed inicial — cria primeiro admin a partir das envs.
 * Roda com:  pnpm prisma:seed
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? 'admin@local').toLowerCase();
  const senha = process.env.ADMIN_PASSWORD ?? 'admin123';
  const nome = process.env.ADMIN_NAME ?? 'Administrador';

  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) {
    console.log(`✓ Admin ${email} já existe (id=${existing.id}).`);
    return;
  }

  const senhaHash = await argon2.hash(senha);
  const u = await prisma.adminUser.create({
    data: { email, nome, senhaHash, ativo: true },
  });
  console.log(`✓ Admin criado: ${u.email}  /  senha: ${senha}`);
  console.log('  ⚠ Troque a senha em produção e remova ADMIN_PASSWORD do .env.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
