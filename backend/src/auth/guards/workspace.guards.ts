import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class WorkspaceGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    const user = request.user;
    const workspaceId = request.params.workspaceId;

    if (!user) {
      throw new ForbiddenException(
        'User not authenticated',
      );
    }

    // PLATFORM_ADMIN no pertenece a un Workspace específico.
    // Puede acceder a cualquier Workspace.
    if (user.role === 'PLATFORM_ADMIN') {
      return true;
    }

    // OWNER, ADMIN y AGENT deben tener un Workspace asociado.
    if (!user.workspaceId) {
      throw new ForbiddenException(
        'User is not associated with a workspace',
      );
    }

    // El usuario solamente puede acceder a su propio Workspace.
    if (user.workspaceId !== workspaceId) {
      throw new ForbiddenException(
        'You cannot access another workspace',
      );
    }

    return true;
  }
}