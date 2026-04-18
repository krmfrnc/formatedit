import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type User, type UserRole } from '@prisma/client';
import { PrismaService } from '../../../prisma.service';

export interface AdminUserListQuery {
  search?: string;
  role?: UserRole;
  take?: number;
  cursor?: string;
}

export interface AdminUserListResult {
  items: Array<Pick<
    User,
    'id' | 'email' | 'fullName' | 'role' | 'academicTitle' | 'isEmailVerified' | 'preferredLanguage' | 'country' | 'createdAt'
  >>;
  nextCursor: string | null;
}

/**
 * Task 275: Admin user management.
 *
 * Read-oriented endpoints backing the admin UI: search by email/name,
 * filter by role, cursor-paginated listing. Write endpoints are limited to
 * role elevation and email-verification override — destructive operations
 * (account deletion, password reset) go through dedicated flows elsewhere.
 */
@Injectable()
export class AdminUsersService {
  constructor(private readonly prismaService: PrismaService) {}

  async list(query: AdminUserListQuery): Promise<AdminUserListResult> {
    const take = Math.min(Math.max(query.take ?? 25, 1), 100);
    const where: Prisma.UserWhereInput = {};
    if (query.role) where.role = query.role;
    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { email: { contains: term, mode: 'insensitive' } },
        { fullName: { contains: term, mode: 'insensitive' } },
      ];
    }
    const items = await this.prismaService.user.findMany({
      where,
      take: take + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        academicTitle: true,
        isEmailVerified: true,
        preferredLanguage: true,
        country: true,
        createdAt: true,
      },
    });
    const nextCursor = items.length > take ? (items[take - 1]?.id ?? null) : null;
    return { items: items.slice(0, take), nextCursor };
  }

  async updateRole(userId: string, role: UserRole): Promise<User> {
    const existing = await this.prismaService.user.findUnique({ where: { id: userId } });
    if (!existing) throw new NotFoundException('User not found');
    return this.prismaService.user.update({ where: { id: userId }, data: { role } });
  }

  async setEmailVerified(userId: string, verified: boolean): Promise<User> {
    const existing = await this.prismaService.user.findUnique({ where: { id: userId } });
    if (!existing) throw new NotFoundException('User not found');
    return this.prismaService.user.update({
      where: { id: userId },
      data: { isEmailVerified: verified },
    });
  }
}
