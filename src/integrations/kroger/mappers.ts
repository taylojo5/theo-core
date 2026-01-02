import { KrogerChain } from "@prisma/client";
import {
  KrogerApiProduct,
  KrogerApiStore,
  LeanKrogerProduct,
  LeanKrogerStore,
} from "./types";
import { Decimal } from "@prisma/client/runtime/library";

export function mapKrogerStoreToInternal(
  store: KrogerApiStore
): LeanKrogerStore {
  return {
    storeId: store.locationId,
    divisionId: store.divisionNumber,
    chain: store.chain as KrogerChain,
    name: store.name,
    addressLine1: store.address.addressLine1,
    addressLine2: store.address.addressLine2 ?? null,
    city: store.address.city,
    state: store.address.state,
    zipCode: store.address.zipCode,
    county: store.address.county ?? null,
    phone: store.phone,
    latitude: new Decimal(store.geolocation.latitude),
    longitude: new Decimal(store.geolocation.longitude),
    timezone: store.hours.timezone,
    gmtOffset: store.hours.gmtOffset ?? null,
    open24Hours: store.hours.open24,
    hours: store.hours,
  };
}

export function mapKrogerProductToInternal(
  product: KrogerApiProduct
): LeanKrogerProduct {
  const defaultImage = product.images
    .filter((image) => image.default)?.[0]
    ?.sizes?.filter((size) => size.size === "medium")?.[0]?.url;
  return {
    productId: product.productId,
    upc: product.upc,
    brand: product.brand,
    description: product.description,
    categories: product.categories,
    alcohol: product.alcohol,
    alcoholProof: product.alcoholProof,
    ageRestriction: product.ageRestriction,
    snapEligible: product.snapEligible,
    manufacturerDeclarations: product.manufacturerDeclarations,
    sweeteningMethods: product.sweeteningMethods?.name,
    allergens: product.allergens.map((allergen) => allergen.name),
    allergensDescription: product.allergensDescription,
    certifiedForPassover: product.certifiedForPassover,
    hypoallergenic: product.hypoallergenic,
    nonGmo: product.nonGmo,
    nonGmoClaimName: product.nonGmoClaimName,
    organicClaimName: product.organicClaimName,
    receiptDescription: product.receiptDescription,
    warnings: product.warnings,
    itemInformation: product.itemInformation,
    heatSensitive: product.temperature.heatSensitive,
    temperatureIndicator: product.temperature.indicator,
    defaultImageUrl: defaultImage,
    averageRating: new Decimal(product.ratingsAndReviews.averageOverallRating),
    totalReviews: product.ratingsAndReviews.totalReviewCount,
  };
}
