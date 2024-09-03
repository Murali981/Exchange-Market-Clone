import { z } from "zod";

export const OrderInputSchema = z.object({
  baseAsset: z.string(),
  quoteAsset: z.string(),
  price: z.number(),
  quantity: z.number(),
  side: z.enum(["buy", "sell"]),
  type: z.enum(["limit", "market"]),
  kind: z.enum(["ioc"]).optional(), // This is an optional flag where the user can send "ioc" which stands for "immediate (or) cancel" , This means
  // that whatever the user wants to execute it should either the user's order should completely execute (or) you have to tell the user that sorry
  // We don't have the enough liquidity for you that we can't match all of your orders
});
