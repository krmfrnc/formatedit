import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PasswordService {
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  async verifyPassword(password: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(password, passwordHash);
  }

  async hashOneTimeCode(code: string): Promise<string> {
    return bcrypt.hash(code, 10);
  }

  async verifyOneTimeCode(code: string, codeHash: string): Promise<boolean> {
    return bcrypt.compare(code, codeHash);
  }

  generateOneTimeCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}
