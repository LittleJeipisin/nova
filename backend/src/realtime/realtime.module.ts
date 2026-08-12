import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import {
  ConfigModule,
  ConfigService,
} from '@nestjs/config';

import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';

import { PrismaModule } from '../prisma/prisma.module';
import { VisitorsModule } from '../visitors/visitors.module';

@Module({
  imports: [
    PrismaModule,
    VisitorsModule,

    JwtModule.registerAsync({
      imports: [
        ConfigModule,
      ],
      inject: [
        ConfigService,
      ],
      useFactory: (
        configService: ConfigService,
      ) => ({
        secret:
          configService.get<string>(
            'JWT_SECRET',
          ),
        signOptions: {
          expiresIn: '1h',
        },
      }),
    }),
  ],

  providers: [
    RealtimeGateway,
    RealtimeService,
  ],

  exports: [
    RealtimeService,
  ],
})
export class RealtimeModule {}