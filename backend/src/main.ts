import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: '*' });
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`\n⚙  Kioti Backend (NestJS)`);
  console.log(`   http://localhost:${port}/api`);
}
bootstrap();
