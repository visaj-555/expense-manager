import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from 'src/modules/auth/interfaces/auth.interface';

// decorators/get-user.decorator.ts
export const GetUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user?: JwtPayload }>();
    
    if (!request.user) {
      throw new Error('GetUser decorator used without JwtAuthGuard');
    }

    if (data) {
      return request.user[data as keyof JwtPayload]; // e.g. 'userId'
    }

    return request.user;
  },
);