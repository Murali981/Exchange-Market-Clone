import { Client } from "pg";
import { Router } from "express";
import { RedisManager } from "../RedisManager";

const pgClient = new Client({
  user: "your_user",
  host: "localhost",
  database: "my_database",
  password: "your_password",
  port: 5432,
});
pgClient.connect();

export const klineRouter = Router();

klineRouter.get("/", async (req, res) => {
  const { market, interval, startTime, endTime } = req.query;

  // Convert startTime and endTime to numbers and validate
  const startTimestamp = Number(startTime);
  const endTimestamp = Number(endTime);

  if (isNaN(startTimestamp) || isNaN(endTimestamp)) {
    return res.status(400).send("Invalid startTime or endTime");
  }

  let query;
  switch (interval) {
    case "1m":
      query = `SELECT * FROM klines_1m WHERE bucket >= $1 AND bucket <= $2`;
      break;
    case "1h":
      query = `SELECT * FROM klines_1m WHERE  bucket >= $1 AND bucket <= $2`;
      break;
    case "1w":
      query = `SELECT * FROM klines_1w WHERE bucket >= $1 AND bucket <= $2`;
      break;
    default:
      return res.status(400).send("Invalid interval");
  }

  try {
    //@ts-ignore
    const result = await pgClient.query(query, [
      new Date(startTimestamp * 1000),
      new Date(endTimestamp * 1000),
    ]);
    res.json(
      result.rows.map((x) => ({
        close: x.close,
        end: x.bucket,
        high: x.high,
        low: x.low,
        open: x.open,
        quoteVolume: x.quoteVolume,
        start: x.start,
        trades: x.trades,
        volume: x.volume,
      }))
    );
  } catch (err) {
    console.log(err);
    res.status(500).send(err);
  }
});
