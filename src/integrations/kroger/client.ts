import { getKrogerTokenSet } from "./auth/connection";
import { mapKrogerStoreToInternal } from "./mappers";
import {
  KrogerClientConfig,
  KrogerStoreSearchParams,
  LeanKrogerStore,
} from "./types";
import { KrogerChain } from "@prisma/client";

class KrogerClient {
  private readonly baseUrl: string;
  private readonly config: KrogerClientConfig;

  constructor(config: KrogerClientConfig) {
    this.baseUrl = process.env.KROGER_API_BASE_URL ?? "";
    this.config = {
      userId: config.userId,
      radiusMiles: config.radiusMiles ?? 10,
      limit: config.limit ?? 10,
      chain: config.chain ?? undefined,
    };
  }

  private async getAccessToken(): Promise<string> {
    const tokenSet = await getKrogerTokenSet(this.config.userId);
    if (!tokenSet) {
      throw new Error("Failed to get access token");
    }
    return tokenSet.accessToken;
  }

  async searchStores(
    params: KrogerStoreSearchParams
  ): Promise<LeanKrogerStore[]> {
    const accessToken = await this.getAccessToken();
    const url = new URL(`${this.baseUrl}/locations`);
    url.searchParams.set("filter.zipCode.near", params.zipCode);
    url.searchParams.set(
      "filter.radiusInMiles",
      (params.radiusMiles ?? this.config.radiusMiles ?? 10).toString()
    );
    url.searchParams.set(
      "filter.limit",
      (params.limit ?? this.config.limit ?? 10).toString()
    );
    url.searchParams.set(
      "filter.chain",
      (params.chain ?? this.config.chain ?? KrogerChain.KROGER).toString()
    );

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      console.error(`Failed to search stores: ${response.statusText}`);
      console.error(await response.text());
      throw new Error(`Failed to search stores: ${response.statusText}`);
    }

    const body = await response.json();
    return body.data.map(mapKrogerStoreToInternal) as LeanKrogerStore[];
  }

  async getStore(storeId: string): Promise<LeanKrogerStore> {
    const accessToken = await this.getAccessToken();
    const response = await fetch(
      `${this.baseUrl}/locations?filter.locationId=${storeId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get store: ${response.statusText}`);
    }

    const body = await response.json();
    return mapKrogerStoreToInternal(body.data);
  }
}

export default KrogerClient;
