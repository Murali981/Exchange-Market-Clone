import { createClient } from "redis";
import { Engine } from "./trade/Engine";
///// What does this index.ts file will do as this file is the starting point of execution of the engine ? ///////////
async function main() {
  const engine = new Engine(); // It is creating a new instance of the engine.
  const redisClient = createClient(); // It is creating a new redis client
  await redisClient.connect(); // We are connecting the Redis Client
  console.log("connected to redis");

  while (true) {
    // This loop which is infinitely running will pulls messages from the queue
    const response = await redisClient.rPop("messages" as string);
    if (!response) {
    } else {
      engine.process(JSON.parse(response)); // It is calling the process function on the engine and once the processing is
      // done then it will move to the next one . If you observe this engine.process() function is not an asynchronous call
      // because it should happen immediately as we are not storing anything in the database so  this process should happen
      // asynchronously and also the javascript thread is continously running where it is doing two things continously , One
      // thing is putting things on a orderbook array(orderbook[]) and the second thing is changing the balances of the user
    }
  }
}

main();
