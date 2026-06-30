import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: '*' });

  const prisma = app.get(PrismaService);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS daily_visits (
      date DATE PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 0
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS visit_sessions (
      date       DATE NOT NULL,
      session_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (date, session_id)
    )
  `);
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`\n⚙  Kioti Backend (NestJS)`);
  console.log(`   http://localhost:${port}/api`);
}
bootstrap();
