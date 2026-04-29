import { Module } from '@nestjs/common';
import { TotemController } from './totem.controller';
import { TotemService } from './totem.service';
import { RecognitionModule } from '../recognition/recognition.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [RecognitionModule, AuthModule],
  controllers: [TotemController],
  providers: [TotemService],
  exports: [TotemService],
})
export class TotemModule {}
