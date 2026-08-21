import { Module, ValidationPipe, BadRequestException } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  APP_FILTER,
  APP_INTERCEPTOR,
  APP_PIPE,
} from '@nestjs/core';
import {
  I18nModule,
  QueryResolver,
  AcceptLanguageResolver,
} from 'nestjs-i18n';
import * as path from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { CategoriesModule } from './modules/categories/categories.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { TransfersModule } from './modules/transfers/transfers.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { GoalsModule } from './modules/goals/goals.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AutomationsModule } from './modules/automations/automations.module';

// ------------ ENVIRONMENT NORMALIZATION ------------ //
const NODE_ENV = process.env.NODE_ENV ?? 'development';
const APP_ENV = process.env.APP_ENV ?? 'local';

const isProd = NODE_ENV === 'production';

// ------------ I18N PATH RESOLUTION ------------ //
const I18N_PATH =
  NODE_ENV === 'production'
    ? path.join(__dirname, '..', 'common', 'i18n')
    : path.join(process.cwd(), 'src/common/i18n');

console.log('I18N_PATH:', I18N_PATH);
console.log('NODE_ENV:', NODE_ENV);
console.log('isProd:', isProd);

@Module({
  imports: [
    // ------------ GLOBAL CONFIGURATION ------------ //
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        `.env.${APP_ENV}`, // .env.local | .env.stage | .env.prod
        '.env',
      ],
    }),

    // ------------ INTERNATIONALIZATION (I18N) ------------ //
    I18nModule.forRoot({
      fallbackLanguage: 'en',
      loaderOptions: {
        path: I18N_PATH,
        watch: !isProd,
      },
      resolvers: [
        { use: QueryResolver, options: ['lang'] },
        AcceptLanguageResolver,
      ],
    }),

    AuthModule,
    CategoriesModule,
    AccountsModule,
    TransactionsModule,
    TransfersModule,
    DashboardModule,
    GoalsModule,
    TransfersModule,
    AnalyticsModule,
    AutomationsModule,

  ],

  controllers: [AppController],

  providers: [
    AppService,

    // ------------ GLOBAL RESPONSE INTERCEPTOR ------------ //
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },

    // ------------ GLOBAL EXCEPTION FILTER ------------ //
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },

    // ------------ GLOBAL VALIDATION PIPE ------------ //
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
        exceptionFactory: (errors) => {
          return new BadRequestException(errors);
        },
      }),
    },
  ],
})
export class AppModule { }