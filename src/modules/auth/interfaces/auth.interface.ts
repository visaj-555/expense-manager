import { Auth } from "src/generated/prisma/client";

export type AuthPublic = Omit<Auth, 'password'>;

export interface JwtPayload {
  authId: string;
  userId: string;
  role: string;
}
