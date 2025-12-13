
import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class DebugJwtAuthGuard extends AuthGuard('jwt') {
    canActivate(context: ExecutionContext) {
        const request = context.switchToHttp().getRequest();
        console.log('--- DebugJwtAuthGuard Request ---');
        console.log('Path:', request.url);
        console.log('Authorization Header:', request.headers.authorization ? 'PRESENT' : 'MISSING');
        if (request.headers.authorization) {
            console.log('Authorization Value:', request.headers.authorization);
        }
        return super.canActivate(context);
    }


    handleRequest(err, user, info) {
        // You can throw an exception based on either "info" or "err" arguments
        if (err || !user) {
            console.error('--- DebugJwtAuthGuard Error ---');
            console.error('Error:', err);
            console.error('Info:', info); // Info often contains the specific JWT error (e.g., "invalid signature", "jwt expired")
            console.error('User:', user);
            throw err || new UnauthorizedException();
        }
        return user;
    }
}
