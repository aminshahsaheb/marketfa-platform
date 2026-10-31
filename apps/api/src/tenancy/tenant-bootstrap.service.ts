import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import type { AuthenticatedActor } from "../database/database.service";

export interface TenantBootstrapInput {
  readonly displayName: string;
  readonly legalName: string | null;
  readonly storeName: string;
}

export interface TenantBootstrapResult {
  readonly tenantId: string;
  readonly storeId: string;
  readonly ownerMembershipId: string;
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
    const result = await this.database.withAuthenticatedActor(
      actor,
      async (client) =>
        client.query<{
          created_tenant_id: string;
          created_store_id: string;
          owner_membership_id: string;
        }>("SELECT * FROM public.tenant_bootstrap($1, $2, $3)", [
          input.displayName,
          input.legalName,
          input.storeName,
        ]),
    );

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
    };
  }
}
