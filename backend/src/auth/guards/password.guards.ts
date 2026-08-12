import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class PasswordChangedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException(
        'Usuario no autenticado',
      );
    }

    if (user.mustChangePassword) {
      throw new ForbiddenException(
        'Debes cambiar tu contraseña antes de continuar',
      );
    }

    return true;
  }
}