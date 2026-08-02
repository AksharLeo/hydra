import { net } from "electron";

const STEAM_SEARCH = "https://store.steampowered.com/api/storesearch";
const STEAM_DETAILS = "https://store.steampowered.com/api/appdetails";

const detailsCache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 86_400_000; // 24h

async function fetchJson(url: string): Promise<any> {
  const res = await net.fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const protondbCache = new Map<string, { tier: string | null; ts: number }>();

async function fetchProtondbTier(appId: string): Promise<string | null> {
  const cached = protondbCache.get(appId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.tier;
  const json = await fetchJson(
    `https://www.protondb.com/api/v1/reports/summaries/${appId}.json`
  ).catch(() => null);
  const tier = json?.tier || null;
  protondbCache.set(appId, { tier, ts: Date.now() });
  return tier;
}

async function fetchSteamDetails(
  appId: string,
  lang = "english"
): Promise<any> {
  const key = `${appId}:${lang}`;
  const cached = detailsCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;
  const url = `${STEAM_DETAILS}?appids=${appId}&l=${lang}&cc=us`;
  const json = await fetchJson(url).catch(() => null);
  const data = json?.[appId];
  if (data?.success) {
    detailsCache.set(key, { data: data.data, ts: Date.now() });
    return data.data;
  }
  return null;
}

function steamAsset(
  id: string,
  name: string,
  d?: any,
  headerOverride?: string
) {
  return {
    id: String(id),
    objectId: String(id),
    title: name,
    shop: "steam" as const,
    genres: (d?.genres ?? []).map((g: any) => g.description),
    releaseYear: d?.release_date?.date
      ? parseInt(d.release_date.date.split(",").pop()?.trim() ?? "0")
      : null,
    libraryImageUrl:
      headerOverride ||
      `https://shared.steamstatic.com/store_item_assets/steam/apps/${id}/header.jpg`,
    coverImageUrl: `https://shared.steamstatic.com/store_item_assets/steam/apps/${id}/library_600x900_2x.jpg`,
    downloadSources: [],
    tier: undefined as string | null | undefined,
  };
}

export async function steamCatalogueSearch(body: any): Promise<any> {
  const {
    title = "",
    take = 20,
    skip = 0,
    genres: filterGenres = [],
    protondbSupportBadges = [],
    sortBy = "popularity",
    sortOrder = "desc",
  } = body ?? {};

  let allEdges: any[] = [];
  let totalCount = 0;

  const needsFullDetails = filterGenres.length > 0 || sortBy === "releaseDate";
  const needsProtonDb = protondbSupportBadges.length > 0;

  if (!title) {
    // If there is no search title, use Steam250 to get a large pool of popular games
    const { getSteam250List } = await import("./steam-250");
    const gamesList = await getSteam250List();

    if (needsFullDetails || needsProtonDb) {
      const filteredEdges: any[] = [];
      // Lazy evaluation to prevent IP bans (Steam allows ~200 requests/5min)
      for (const game of gamesList) {
        // If we have enough for the requested page, stop!
        if (filteredEdges.length >= skip + take) break;

        let d = null;
        if (needsFullDetails) {
          d = await fetchSteamDetails(game.objectId).catch(() => null);
        }
        const edge = steamAsset(game.objectId, game.title, d, game.imageUrl);
        if (needsProtonDb) {
          edge.tier = await fetchProtondbTier(game.objectId);
        }

        let include = true;
        if (filterGenres.length > 0) {
          include = filterGenres.some((g: string) => edge.genres.includes(g));
        }
        if (include && protondbSupportBadges.length > 0) {
          include = !!(edge.tier && protondbSupportBadges.includes(edge.tier));
        }

        if (include) {
          filteredEdges.push(edge);
        }
      }
      allEdges = filteredEdges;
      totalCount = gamesList.length; // Approximate total since we didn't filter all
    } else {
      allEdges = gamesList.map((game) =>
        steamAsset(game.objectId, game.title, undefined, game.imageUrl)
      );
      totalCount = allEdges.length;
    }

    // Sort Steam250 games if requested (popularity is the default order they come in)
    if (
      sortBy &&
      sortBy !== "popularity" &&
      sortBy !== "reviewScore" &&
      sortBy !== "hydraScore"
    ) {
      allEdges.sort((a, b) => {
        if (sortBy === "releaseDate") {
          return (a.releaseYear ?? 0) - (b.releaseYear ?? 0);
        }
        if (sortBy === "alphabetical") {
          return a.title.localeCompare(b.title);
        }
        return 0;
      });
      if (sortOrder === "desc") {
        allEdges.reverse();
      }
    } else if (sortBy === "popularity" && sortOrder === "asc") {
      allEdges.reverse();
    }
  } else {
    // If title is provided, use Steam storesearch which acts as an autocomplete
    const seen = new Set<string>();
    let page = 1;
    let hasMore = true;
    const maxPages = 5;

    while (allEdges.length < skip + take && page <= maxPages && hasMore) {
      const json = await fetchJson(
        `${STEAM_SEARCH}?term=${encodeURIComponent(title)}&l=english&cc=us&json=1&page=${page}`
      ).catch(() => null);

      const items: any[] = json?.items ?? [];
      if (items.length === 0) {
        hasMore = false;
        break;
      }

      const newItems = items.filter((item) => {
        const id = String(item.id);
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });

      // Steam's storesearch ignores pagination, so if it returns items we've already seen, break
      if (newItems.length === 0) {
        hasMore = false;
        break;
      }

      for (const item of newItems) {
        if (allEdges.length >= skip + take) break;

        let d = null;
        if (needsFullDetails) {
          d = await fetchSteamDetails(String(item.id)).catch(() => null);
        }
        const overrideUrl =
          item.header_image || item.large_capsule_image || item.tiny_image;
        const edge = steamAsset(item.id, item.name, d, overrideUrl);

        if (needsProtonDb) {
          edge.tier = await fetchProtondbTier(item.id);
        }

        let include = true;
        if (filterGenres.length > 0) {
          include = filterGenres.some((g: string) => edge.genres.includes(g));
        }
        if (include && protondbSupportBadges.length > 0) {
          include = !!(edge.tier && protondbSupportBadges.includes(edge.tier));
        }

        if (include) {
          allEdges.push(edge);
        }
      }
      page++;
    }

    if (
      sortBy &&
      sortBy !== "popularity" &&
      sortBy !== "reviewScore" &&
      sortBy !== "hydraScore"
    ) {
      allEdges.sort((a, b) => {
        if (sortBy === "releaseDate") {
          return (a.releaseYear ?? 0) - (b.releaseYear ?? 0);
        }
        if (sortBy === "alphabetical") {
          return a.title.localeCompare(b.title);
        }
        return 0;
      });
      if (sortOrder === "desc") {
        allEdges.reverse();
      }
    } else if (sortBy === "popularity" && sortOrder === "asc") {
      allEdges.reverse();
    }

    totalCount = hasMore ? allEdges.length + 10 : allEdges.length;
  }

  const sliced = allEdges.slice(skip, skip + take);

  return { edges: sliced, count: totalCount };
}

export async function steamShopDetails(body: any): Promise<any[]> {
  const { shop, objectIds = [] } = body ?? {};
  if (shop !== "steam") return [];

  const results = await Promise.all(
    (objectIds as string[]).map(async (id) => {
      const d = await fetchSteamDetails(id).catch(() => null);
      if (!d) return null;
      return {
        objectId: id,
        shop: "steam",
        data: {
          title: d.name,
          description: d.detailed_description ?? d.short_description ?? "",
          releaseDate: d.release_date?.date ?? null,
          developers: d.developers ?? [],
          publishers: d.publishers ?? [],
          genres: (d.genres ?? []).map((g: any) => g.description),
          headerImage: d.header_image ?? null,
          website: d.website ?? null,
          screenshots: (d.screenshots ?? []).map((s: any) => s.path_full),
          assets: {
            objectId: id,
            shop: "steam",
            title: d.name,
            iconUrl: null,
            libraryHeroImageUrl:
              d.background ??
              `https://shared.steamstatic.com/store_item_assets/steam/apps/${id}/library_hero.jpg`,
            libraryImageUrl:
              d.header_image ??
              `https://shared.steamstatic.com/store_item_assets/steam/apps/${id}/header.jpg`,
            logoImageUrl: null,
          },
        },
      };
    })
  );
  return results.filter(Boolean) as any[];
}

export async function steamGameBasic(
  objectId: string,
  lang = "english"
): Promise<any> {
  const d = await fetchSteamDetails(objectId, lang);
  if (!d) return null;
  const id = objectId;
  return {
    objectId: id,
    title: d.name,
    iconUrl: null,
    libraryHeroImageUrl:
      d.background ??
      `https://shared.steamstatic.com/store_item_assets/steam/apps/${id}/library_hero.jpg`,
    libraryImageUrl:
      d.header_image ??
      `https://shared.steamstatic.com/store_item_assets/steam/apps/${id}/header.jpg`,
    logoImageUrl: null,
    logoPosition: null,
    coverImageUrl: `https://shared.steamstatic.com/store_item_assets/steam/apps/${id}/library_600x900_2x.jpg`,
    releaseDate: d.release_date?.date ?? null,
    releaseYear: d.release_date?.date
      ? parseInt(d.release_date.date.split(",").pop()?.trim() ?? "0")
      : null,
  };
}

export async function steamCatalogueCategory(
  category: string,
  take = 12
): Promise<any[]> {
  const { requestSteam250 } = await import("./steam-250");
  const path =
    category === "hot"
      ? "/most_played"
      : category === "weekly"
        ? "/7day"
        : "/top250"; // Fallback for achievements/specials

  const items = await requestSteam250(path);

  // Fallback to steamAsset for each item. We don't fetch full details
  // immediately to save API calls and make it fast.
  // Users will see header image which Steam250 items always have on Steam.
  return items
    .slice(0, take)
    .map((item: any) =>
      steamAsset(
        item.objectId,
        item.title,
        undefined,
        `https://shared.steamstatic.com/store_item_assets/steam/apps/${item.objectId}/header.jpg`
      )
    );
}

export async function steamSearchSuggestions(
  query: string,
  limit = 5
): Promise<any[]> {
  if (!query) return [];
  const json = await fetchJson(
    `${STEAM_SEARCH}?term=${encodeURIComponent(query)}&l=english&cc=us&json=1`
  ).catch(() => null);
  const items: any[] = json?.items ?? [];
  return items.slice(0, limit).map((item: any) => ({
    title: item.name,
    objectId: String(item.id),
    shop: "steam",
    iconUrl: null,
  }));
}
