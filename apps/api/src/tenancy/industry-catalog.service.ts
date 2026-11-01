import { Inject, Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

export interface IndustryCatalogItem {
  readonly id: string;
  readonly profileVersion: number;
  readonly labelKey: string;
  readonly group: string;
  readonly regulated: boolean;
  readonly capabilities: readonly string[];
}

interface IndustryCatalogRow {
  industry_key: string;
  profile_version: number;
  display_name_key: string;
  group_key: string;
  is_regulated: boolean;
  capability_key: string | null;
}

@Injectable()
export class IndustryCatalogService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async list(): Promise<IndustryCatalogItem[]> {
    const result = await this.database.withPublicReader((client) =>
      client.query<IndustryCatalogRow>(
        `SELECT
           industry.industry_key,
           industry.profile_version,
           industry.display_name_key,
           industry.group_key,
           industry.is_regulated,
           defaults.capability_key
         FROM industry_catalog AS industry
         LEFT JOIN industry_capability_defaults AS defaults
           ON defaults.industry_key = industry.industry_key
          AND defaults.profile_version = industry.profile_version
         LEFT JOIN capability_catalog AS capability
           ON capability.capability_key = defaults.capability_key
          AND capability.status = 'ACTIVE'
         WHERE industry.status = 'ACTIVE'
           AND (defaults.capability_key IS NULL OR capability.capability_key IS NOT NULL)
         ORDER BY
           industry.group_key,
           industry.display_name_key,
           defaults.capability_key`,
      ),
    );

    const profiles = new Map<string, {
      id: string;
      profileVersion: number;
      labelKey: string;
      group: string;
      regulated: boolean;
      capabilities: string[];
    }>();

    for (const row of result.rows) {
      const key = `${row.industry_key}:${row.profile_version}`;
      let profile = profiles.get(key);
      if (!profile) {
        profile = {
          id: row.industry_key,
          profileVersion: row.profile_version,
          labelKey: row.display_name_key,
          group: row.group_key,
          regulated: row.is_regulated,
          capabilities: [],
        };
        profiles.set(key, profile);
      }
      if (row.capability_key) {
        profile.capabilities.push(row.capability_key);
      }
    }

    return Array.from(profiles.values());
  }
}
