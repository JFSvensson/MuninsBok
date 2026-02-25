/**
 * User — en inloggad användare i systemet.
 */
export interface User {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  /** Argon2-hash — never expose outside the backend */
  readonly passwordHash: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Public-safe subset of User (without passwordHash). */
export type SafeUser = Omit<User, "passwordHash">;

export interface CreateUserInput {
  readonly email: string;
  readonly name: string;
  readonly passwordHash: string;
}

export type UserError =
  | { readonly code: "EMAIL_TAKEN"; readonly message: string }
  | { readonly code: "INVALID_EMAIL"; readonly message: string };

/** Roles a user can hold within an organization. */
export type MemberRole = "OWNER" | "ADMIN" | "MEMBER";

export interface OrganizationMember {
  readonly id: string;
  readonly userId: string;
  readonly organizationId: string;
  readonly role: MemberRole;
  readonly createdAt: Date;
}

export interface OrganizationMemberWithUser extends OrganizationMember {
  readonly user: SafeUser;
}
