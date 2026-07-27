import type { GameShop, ShopAssets } from "@types";
import { registerEvent } from "../register-event";
import { fetchGameArtwork, HydraApi } from "@main/services";
import {
  gamesArtworkSelectionSublevel,
  gamesShopAssetsSublevel,
  levelKeys,
} from "@main/level";
import { composeAssetsWithArtwork } from "@shared";

const LOCAL_CACHE_EXPIRATION = 1000 * 60 * 60 * 8; // 8 hours

const applyArtworkSelection = async <T extends ShopAssets | null>(
  gameKey: string,
  assets: T
): Promise<T> => {
  if (!assets) return assets;

  const selection = await gamesArtworkSelectionSublevel.get(gameKey);

  return composeAssetsWithArtwork(assets, selection);
};

const fallbackArtworkUrl = async (
  shop: GameShop,
  objectId: string,
  kind: "icons" | "logos" | "heroes"
): Promise<string | null> => {
  try {
    const page = await fetchGameArtwork(shop, objectId, kind);
    if (page.items.length > 0) {
      const item = page.items[0];
      return kind === "heroes" ? item.url : item.thumb;
    }
  } catch {
    /* non-fatal */
  }
  return null;
};

const buildMinimalAssets = async (
  shop: GameShop,
  objectId: string,
  title: string
): Promise<ShopAssets | null> => {
  const iconUrl = await fallbackArtworkUrl(shop, objectId, "icons");
  const logoImageUrl = await fallbackArtworkUrl(shop, objectId, "logos");
  const libraryHeroImageUrl = await fallbackArtworkUrl(shop, objectId, "heroes");

  if (!iconUrl && !logoImageUrl && !libraryHeroImageUrl) return null;

  return {
    objectId,
    shop,
    title,
    iconUrl,
    libraryHeroImageUrl,
    libraryImageUrl: null,
    logoImageUrl,
    logoPosition: null,
    coverImageUrl: null,
    downloadSources: [],
  };
};

export const getGameAssets = async (
  objectId: string,
  shop: GameShop,
  options?: { forceFresh?: boolean }
) => {
  if (shop === "custom") {
    return null;
  }

  const gameKey = levelKeys.game(shop, objectId);
  const cachedAssets = await gamesShopAssetsSublevel.get(gameKey);

  if (
    !options?.forceFresh &&
    cachedAssets &&
    cachedAssets.updatedAt + LOCAL_CACHE_EXPIRATION > Date.now() &&
    cachedAssets.iconUrl
  ) {
    return applyArtworkSelection(gameKey, cachedAssets);
  }

  const assets = await HydraApi.get<ShopAssets | null>(
    `/games/${shop}/${objectId}/assets`,
    null,
    {
      needsAuth: false,
    }
  ).catch(() => null);

  const title =
    assets?.title ??
    cachedAssets?.title ??
    "";

  if (assets) {
    const iconUrl =
      assets.iconUrl ?? (await fallbackArtworkUrl(shop, objectId, "icons"));
    const logoImageUrl =
      assets.logoImageUrl ?? (await fallbackArtworkUrl(shop, objectId, "logos"));
    const libraryHeroImageUrl =
      assets.libraryHeroImageUrl ??
      (await fallbackArtworkUrl(shop, objectId, "heroes"));

    const enrichedAssets: ShopAssets & { updatedAt: number } = {
      ...assets,
      iconUrl,
      logoImageUrl,
      libraryHeroImageUrl,
      updatedAt: Date.now(),
    };

    await gamesShopAssetsSublevel.put(gameKey, enrichedAssets);

    return applyArtworkSelection(gameKey, enrichedAssets);
  }

  const minimalAssets = await buildMinimalAssets(shop, objectId, title);

  if (minimalAssets) {
    await gamesShopAssetsSublevel.put(gameKey, {
      ...minimalAssets,
      updatedAt: Date.now(),
    });

    return applyArtworkSelection(gameKey, minimalAssets);
  }

  await gamesShopAssetsSublevel.put(gameKey, {
    objectId,
    shop,
    title,
    iconUrl: null,
    libraryHeroImageUrl: null,
    libraryImageUrl: null,
    logoImageUrl: null,
    logoPosition: null,
    coverImageUrl: null,
    downloadSources: [],
    updatedAt: Date.now(),
  });

  return null;
};

const getGameAssetsEvent = async (
  _event: Electron.IpcMainInvokeEvent,
  objectId: string,
  shop: GameShop,
  options?: { forceFresh?: boolean }
) => getGameAssets(objectId, shop, options);

registerEvent("getGameAssets", getGameAssetsEvent);
