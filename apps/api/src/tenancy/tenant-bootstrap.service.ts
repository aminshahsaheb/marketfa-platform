import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import type { AuthenticatedActor } from "../database/database.service";

export interface TenantBootstrapInput {
  readonly displayName: string;
  readonly legalName: string | null;
  readonly locationName?: string;
  readonly storeName?: string | null;
  readonly industryId?: string;
}

export interface TenantBootstrapResult {
  readonly tenantId: string;
  readonly storeId: string | null;
  readonly ownerMembershipId: string;
  readonly businessProfileId: string;
  readonly businessLocationId: string;
  readonly accountingBookId: string;
}

function isInvalidInputError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "22023"
  );
}

@Injectable()
export class TenantBootstrapService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async create(
    actor: AuthenticatedActor,
    input: TenantBootstrapInput,
  ): Promise<TenantBootstrapResult> {
    const locationName = input.locationName ?? input.storeName ?? "Main location";
    const storeName = input.storeName ?? null;
    const industryId = input.industryId ?? "general-retail";
    let result;

    try {
      result = await this.database.withAuthenticatedActor(actor, (client) =>
        client.query<{
          created_tenant_id: string;
          created_store_id: string | null;
          owner_membership_id: string;
          created_business_profile_id: string;
          created_business_location_id: string;
          created_accounting_book_id: string;
        }>("SELECT * FROM public.tenant_bootstrap($1, $2, $3, $4, $5)", [
          input.displayName,
          input.legalName,
          locationName,
          storeName,
          industryId,
        ]),
      );
    } catch (error) {
      if (isInvalidInputError(error)) {
        throw new BadRequestException(
          "The business details or selected industry are invalid.",
        );
      }
      throw error;
    }

    const row = result.rows[0];
    if (!row) {
      throw new ForbiddenException(
        "An active authenticated user is required to create a tenant.",
      );
    }

    return {
      tenantId: row.created_tenant_id,
      storeId: row.created_store_id,
      ownerMembershipId: row.owner_membership_id,
      businessProfileId: row.created_business_profile_id,
      businessLocationId: row.created_business_location_id,
      accountingBookId: row.created_accounting_book_id,
    };
  }
}
