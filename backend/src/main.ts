import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: '*' });

  const prisma = app.get(PrismaService);
  // Add owner columns if not yet present (idempotent)
  await prisma.$executeRawUnsafe(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS owner_id   TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS owner_name TEXT`);

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

  // Weekly report email tables
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS email_recipients (
      id         SERIAL PRIMARY KEY,
      email      TEXT NOT NULL UNIQUE,
      name       TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS recipient_departments (
      recipient_id INTEGER NOT NULL REFERENCES email_recipients(id) ON DELETE CASCADE,
      department   TEXT NOT NULL,
      PRIMARY KEY (recipient_id, department)
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS email_schedules (
      id            SERIAL PRIMARY KEY,
      enabled       BOOLEAN NOT NULL DEFAULT false,
      freq          TEXT NOT NULL DEFAULT 'weekly',
      day_of_week   INTEGER,
      day_of_month  INTEGER,
      hour_est      INTEGER NOT NULL DEFAULT 8,
      minute_est    INTEGER NOT NULL DEFAULT 0,
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_sent_at  TIMESTAMPTZ
    )
  `);
  // Seed default schedule (id=1, Monday 08:00 EST, disabled)
  await prisma.$executeRawUnsafe(`
    INSERT INTO email_schedules (id, enabled, freq, day_of_week, hour_est, minute_est, updated_at)
    VALUES (1, false, 'weekly', 1, 8, 0, NOW())
    ON CONFLICT (id) DO NOTHING
  `);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`\n⚙  Kioti Backend (NestJS)`);
  console.log(`   http://localhost:${port}/api`);
}
bootstrap();
