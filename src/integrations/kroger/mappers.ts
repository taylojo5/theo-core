import { KrogerChain } from "@prisma/client";
import {
  KrogerApiCart,
  KrogerApiProduct,
  KrogerApiStore,
  KrogerCart,
  LeanKrogerProduct,
  LeanKrogerStore,
} from "./types";

export function mapKrogerStoreToInternal(
  store: KrogerApiStore
): LeanKrogerStore {
  return {
    storeId: store.locationId,
    divisionId: store.divisionNumber,
    chain: store.chain as KrogerChain,
    name: store.name,
    phone: store.phone,
    departments: store.departments.map((department) => department.name),
    distanceMiles: null,
  };
}

export function mapKrogerProductToInternal(
  product: KrogerApiProduct
): LeanKrogerProduct {
  return {
    productId: product.productId,
  };
}

export function mapKrogerCartToInternal(
  cart: KrogerApiCart
): Pick<KrogerCart, "storeId"> {
  return {
    storeId: cart.cartId,
  };
}
