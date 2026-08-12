import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import {
  ConfigModule,
  ConfigService,
} from '@nestjs/config';

import { VisitorsController } from './visitors.controller';
import { VisitorsService } from './visitors.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,

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
            'VISITOR_JWT_SECRET',
          ),
      }),
    }),
  ],

  controllers: [
    VisitorsController,
  ],

  providers: [
    VisitorsService,
  ],

  exports: [
    VisitorsService,
  ],
})
export class VisitorsModule {}