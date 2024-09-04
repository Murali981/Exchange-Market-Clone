import axios from "axios";
import { Depth, KLine, Ticker, Trade } from "./types";

const BASE_URL = "https://exchange-proxy.100xdevs.com/api/v1";

export async function getTicker(market: string): Promise<Ticker> {
  const tickers = await getTickers();
  console.log(tickers);
  const ticker = tickers.find((t) => t.symbol === market);
  if (!ticker) {
    throw new Error(`No ticker found for ${market}`);
  }
  return ticker;
}
const x = getTickers();

export async function getTickers(): Promise<number> {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return 1;
}

export async function getDepth(market: string): Promise<Depth> {
  // In the above async function why we have written getTrades(market:string): Promise<Depth> rather writing
  // getDepth(market:string) and also please remember an Async function always returns a promise and later the
  // Promise will be resolved to the actual data that is returning . An async function never returns the actual
  // value but it always returns the promise and this promise will be eventually resolved to the actual value.
  // In the above getDepth() async function context we know that the data that will come will be of type depth.
  // So we have written Promise<Depth> (Promise of type Depth)
  const response = await axios.get(`${BASE_URL}/depth?symbol=${market}`);
  return response.data;
}
export async function getTrades(market: string): Promise<Trade[]> {
  const response = await axios.get(`${BASE_URL}/trades?symbol=${market}`);
  return response.data;
}

export async function getKlines(
  market: string,
  interval: string,
  startTime: number,
  endTime: number
): Promise<KLine[]> {
  const response = await axios.get(
    `${BASE_URL}/klines?symbol=${market}&interval=${interval}&startTime=${startTime}&endTime=${endTime}`
  );
  const data: KLine[] = response.data;
  return data.sort((x, y) => (Number(x.end) < Number(y.end) ? -1 : 1));
}

export async function getMarkets(): Promise<string[]> {
  const response = await axios.get(`${BASE_URL}/markets`);
  return response.data;
}
