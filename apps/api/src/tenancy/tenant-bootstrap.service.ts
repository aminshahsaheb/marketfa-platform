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
  readonly storeName: string;
  readonly industryId: string;
}

export interface TenantBootstrapResult {
  readonly tenantId: string;
  readonly storeId: string;
  readonly ownerMembershipId: string;
  readonly businessProfileId: string;
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
    let result;

    try {
      result = await this.database.withAuthenticatedActor(actor, (client) =>
        client.query<{
          created_tenant_id: string;
          created_store_id: string;
          owner_membership_id: string;
          created_business_profile_id: string;
        }>(
          "SELECT * FROM public.tenant_bootstrap($1, $2, $3, $4)",
          [
            input.displayName,
            input.legalName,
            input.storeName,
            input.industryId,
          ],
        ),
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
    };
  }
}
