import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Movie } from 'src/entity/MovieEntity';
import { User } from 'src/entity/user.entity';
import { Admin } from 'src/entity/admin.entity';
import { RequiredChannel } from 'src/entity/requiredchannel.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Movie, User, Admin, RequiredChannel])],
  providers: [BotService],
})
export class BotModule {}
