export interface Customer {
  readonly id: string;
  readonly organizationId: string;
  readonly customerNumber: number;
  readonly name: string;
  readonly email?: string | undefined;
  readonly phone?: string | undefined;
  readonly address?: string | undefined;
  readonly postalCode?: string | undefined;
  readonly city?: string | undefined;
  readonly country?: string | undefined;
  readonly orgNumber?: string | undefined;
  readonly vatNumber?: string | undefined;
  readonly reference?: string | undefined;
  readonly paymentTermDays: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateCustomerInput {
  readonly name: string;
  readonly email?: string | undefined;
  readonly phone?: string | undefined;
  readonly address?: string | undefined;
  readonly postalCode?: string | undefined;
  readonly city?: string | undefined;
  readonly country?: string | undefined;
  readonly orgNumber?: string | undefined;
  readonly vatNumber?: string | undefined;
  readonly reference?: string | undefined;
  readonly paymentTermDays?: number | undefined;
}

export interface UpdateCustomerInput {
  readonly name?: string | undefined;
  readonly email?: string | undefined;
  readonly phone?: string | undefined;
  readonly address?: string | undefined;
  readonly postalCode?: string | undefined;
  readonly city?: string | undefined;
  readonly country?: string | undefined;
  readonly orgNumber?: string | undefined;
  readonly vatNumber?: string | undefined;
  readonly reference?: string | undefined;
  readonly paymentTermDays?: number | undefined;
}

export type CustomerErrorCode = "DUPLICATE_CUSTOMER_NUMBER" | "NOT_FOUND" | "INVALID_INPUT";

export interface CustomerError {
  readonly code: CustomerErrorCode;
  readonly message: string;
}
