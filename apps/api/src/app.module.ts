import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health.controller';
import { AttendeesModule } from './attendees/attendees.module';
import { EventsModule } from './events/events.module';
import { RecognitionModule } from './recognition/recognition.module';
import { AuthModule } from './auth/auth.module';
import { TotemModule } from './totem/totem.module';
import { StorageModule } from './storage/storage.module';
import { CheckinsModule } from './checkins/checkins.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    StorageModule,
    AuthModule,
    AttendeesModule,
    EventsModule,
    RecognitionModule,
    TotemModule,
    CheckinsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
