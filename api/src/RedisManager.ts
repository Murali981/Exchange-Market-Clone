import { RedisClientType, createClient } from "redis";
import { MessageFromOrderbook } from "./types";
import { MessageToEngine } from "./types/to";

export class RedisManager {
  private client: RedisClientType;
  private publisher: RedisClientType;
  private static instance: RedisManager;

  private constructor() {
    this.client = createClient();
    this.client.connect();
    this.publisher = createClient();
    this.publisher.connect();
  }

  public static getInstance() {
    if (!this.instance) {
      this.instance = new RedisManager();
    }
    return this.instance;
  }

  public sendAndAwait(message: MessageToEngine) {
    // Here we are awaiting on a listener that will respond back after sometime So i have to return a promise here which
    // am doing below.
    return new Promise<MessageFromOrderbook>((resolve) => {
      // returning Promises syntax along with types is little bit
      // hard to understand , So just go through the logic carefully then you will eventually understand.
      // When we are returning a promise , it will take one argument as input (resolve) which is a function and this
      // resolve function you do whatever all async operations and you can hit a database and whenever you are done then
      // you will call the resolve(JSON.parse(message)) function with the final message that the user wants (or) the user recieve
      const id = this.getRandomClientId(); // It is generating a random id
      this.client.subscribe(id, (message) => {
        // This is the callback we are getting
        this.client.unsubscribe(id); // Unsubscribing from the id
        resolve(JSON.parse(message)); // Your promise is getting resolved here
      }); // Here it is subscribing onto the PUBSUB on the random id which is generated above.
      this.publisher.lPush(
        "messages",
        JSON.stringify({ clientId: id, message }) // Here it is sending the message over to the queue with the clientID
        // which is generated above and the final message . This is my clientId and whenever you are done processing please
        // respond back to me . Whenever the "Engine" class is done processing then it publishes to the same clientId with a
        // callback and in that callback you will unsubscribe from that id because before you send the message , subscribe to it
        // and whenever you receive the response then unsubscribe from that Id.
        /////////// Structure of the Message that we push onto the Redis Queue will look like below ///////////
        /* {client : 123123 , message : {type : "CREATE_ORDER" , data : {price , quantity , market , side , userId}}} */
      );
    });
  }

  public getRandomClientId() {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }
}
