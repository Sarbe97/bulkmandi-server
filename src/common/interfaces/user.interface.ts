import { Document } from 'mongoose';
import { UserRole } from '../enums';

export interface IUser {
  id: string;
  email: string;
  role: UserRole;
  organizationId: string;
}

export interface IAuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  organizationId: string;
  user: Document;
}

export interface IJwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  organizationId: string;
  iat?: number;
  exp?: number;
}

export interface IRequestUser extends Request {
  user: IAuthenticatedUser;
}
