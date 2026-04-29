import { Module } from '@nestjs/common';
import { AttendeesController } from './attendees.controller';
import { AttendeesService } from './attendees.service';
import { RecognitionModule } from '../recognition/recognition.module';

@Module({
  imports: [RecognitionModule],
  controllers: [AttendeesController],
  providers: [AttendeesService],
})
export class AttendeesModule {}
