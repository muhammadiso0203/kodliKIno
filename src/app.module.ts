import { Module } from '@nestjs/common';
import { BotModule } from './bot/bot.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Movie } from './entity/MovieEntity';
import { User } from './entity/user.entity';
import { RequiredChannel } from './entity/requiredchannel.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.PG_HOST,
      port: Number(process.env.PG_PORT),
      username: process.env.PG_USER,
      password: String(process.env.PG_PASS),
      database: process.env.PG_DB,
      entities:[Movie, User, RequiredChannel],
      synchronize: true
    }),
    TypeOrmModule.forFeature([Movie, User, RequiredChannel]),
    BotModule
  ],
})
export class AppModule {}
