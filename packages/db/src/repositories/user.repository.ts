import type { PrismaClient } from "../generated/prisma/client.js";
import type {
  User,
  CreateUserInput,
  UserError,
  MemberRole,
  OrganizationMember,
  OrganizationMemberWithUser,
  IUserRepository,
} from "@muninsbok/core/types";
import { ok, err, type Result } from "@muninsbok/core/types";
import { toUser, toOrganizationMember, toOrganizationMemberWithUser } from "../mappers.js";

export class UserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? toUser(user) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    return user ? toUser(user) : null;
  }

  async create(input: CreateUserInput): Promise<Result<User, UserError>> {
    const normalizedEmail = input.email.toLowerCase().trim();

    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      return err({ code: "EMAIL_TAKEN", message: "E-postadressen används redan" });
    }

    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        name: input.name.trim(),
        passwordHash: input.passwordHash,
      },
    });

    return ok(toUser(user));
  }

  async findMembersByOrganization(organizationId: string): Promise<OrganizationMemberWithUser[]> {
    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    });
    return members.map(toOrganizationMemberWithUser);
  }

  async findMembership(userId: string, organizationId: string): Promise<OrganizationMember | null> {
    const member = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });
    return member ? toOrganizationMember(member) : null;
  }

  async addMember(
    userId: string,
    organizationId: string,
    role: MemberRole,
  ): Promise<OrganizationMember> {
    const member = await this.prisma.organizationMember.create({
      data: { userId, organizationId, role },
    });
    return toOrganizationMember(member);
  }

  async removeMember(userId: string, organizationId: string): Promise<boolean> {
    try {
      await this.prisma.organizationMember.delete({
        where: { userId_organizationId: { userId, organizationId } },
      });
      return true;
    } catch {
      return false;
    }
  }

  async findOrganizationsByUser(userId: string): Promise<OrganizationMember[]> {
    const members = await this.prisma.organizationMember.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });
    return members.map(toOrganizationMember);
  }
}
