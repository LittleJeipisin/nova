import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  const username = 'platformadmin';

  const existingAdmin = await prisma.user.findFirst({
    where: {
      username,
      role: 'PLATFORM_ADMIN',
    },
  });

  if (existingAdmin) {
    console.log('El Platform Admin ya existe.');
    return;
  }

  const password = generatePassword();
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      username,
      passwordHash,
      role: 'PLATFORM_ADMIN',
      status: 'ACTIVE',
      mustChangePassword: true,
      workspaceId: null,
    },
  });

  console.log('');
  console.log('========================================');
  console.log(' PLATFORM ADMIN CREADO');
  console.log('========================================');
  console.log(`Username: ${username}`);
  console.log(`Password: ${password}`);
  console.log('========================================');
  console.log('Guarda estas credenciales en un lugar seguro.');
  console.log('');
}

function generatePassword(): string {
  const chars =
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';

  let password = '';

  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return password;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });