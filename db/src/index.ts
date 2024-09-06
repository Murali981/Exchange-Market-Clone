import { Client } from "pg";
import { createClient } from "redis";
import { DbMessage } from "./types";

const pgClient = new Client({
  user: "your_user",
  host: "localhost",
  database: "my_database",
  password: "your_password",
  port: 5432,
});
pgClient.connect();

async function main() {
  const redisClient = createClient();
  await redisClient.connect();
  console.log("connected to redis");

  while (true) {
    // It is running in an infinite loop which pulls messages from the db_processor queue which is a different queue.
    const response = await redisClient.rPop("db_processor" as string);
    if (!response) {
    } else {
      // Whenever it gets a message and if the message type is "TRADE_ADDED" (or) if the trade is created then it will
      // store it in a prices(tata_prices) table where it will store that at this specific time this is the price(time, price)
      const data: DbMessage = JSON.parse(response);
      if (data.type === "TRADE_ADDED") {
        console.log("adding data");
        console.log(data);
        const price = data.data.price;
        const timestamp = new Date(data.data.timestamp);
        const query = "INSERT INTO tata_prices (time, price) VALUES ($1, $2)";
        // TODO: How to add volume?
        const values = [timestamp, price];
        await pgClient.query(query, values);
      }
    }
  }
}

main();
