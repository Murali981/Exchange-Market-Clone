import { WebSocket } from "ws";
import { OutgoingMessage } from "./types/out";
import { SubscriptionManager } from "./SubscriptionManager";
import { IncomingMessage, SUBSCRIBE, UNSUBSCRIBE } from "./types/in";

export class User {
  private id: string;
  private ws: WebSocket;

  constructor(id: string, ws: WebSocket) {
    this.id = id;
    this.ws = ws;
    this.addListeners();
  }

  private subscriptions: string[] = [];

  public subscribe(subscription: string) {
    this.subscriptions.push(subscription);
  }

  public unsubscribe(subscription: string) {
    this.subscriptions = this.subscriptions.filter((s) => s !== subscription);
  }

  emit(message: OutgoingMessage) {
    this.ws.send(JSON.stringify(message));
  }

  private addListeners() {
    this.ws.on("message", (message: string) => {
      // Here whenever the message comes from the end user and if it is of type "SUBSCRIBE" then i will tell the
      // SUBSCRIPTIONMANAGER class that subscribe to this specific topic and let us say the topic is depth@SOL_USDC event (or)
      // topic
      const parsedMessage: IncomingMessage = JSON.parse(message);
      if (parsedMessage.method === SUBSCRIBE) {
        parsedMessage.params.forEach((s) =>
          SubscriptionManager.getInstance().subscribe(this.id, s)
        );
      }

      if (parsedMessage.method === UNSUBSCRIBE) {
        // If the user sends me the "UNSUBSCRIBE" then i will tell the "SUBSCRIPTIONMANAGER" class to unsubscribe from the
        // depth@SOL_USDC event.
        // SUBSCRIPTIONMANAGER CLASS is the class that will handle all the subscriptions that are made to the PUBSUB
        parsedMessage.params.forEach((s) =>
          SubscriptionManager.getInstance().unsubscribe(
            this.id,
            parsedMessage.params[0]
          )
        );
      }
    });
  }
}
