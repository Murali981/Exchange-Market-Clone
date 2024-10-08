import fs from "fs";
import { RedisManager } from "../RedisManager";
import { ORDER_UPDATE, TRADE_ADDED } from "../types/index";
import {
  CANCEL_ORDER,
  CREATE_ORDER,
  GET_DEPTH,
  GET_OPEN_ORDERS,
  MessageFromApi,
  ON_RAMP,
} from "../types/fromApi";
import { Fill, Order, Orderbook } from "./Orderbook";

//TODO: Avoid floats everywhere, use a decimal similar to the PayTM project for every currency
export const BASE_CURRENCY = "INR";

interface UserBalance {
  [key: string]: {
    available: number;
    locked: number;
  };
}

export class Engine {
  // The above Engine class is mantaining two things , one thing is array of order books and the second thing
  // is mantaining the balances of all the users . And this Engine class is holding the above two things inmemory.
  // As the time goes by the balances of the users would change and the order books may become bigger (or) smaller
  // and this Engine class is the source of truth for everything and you keep backing the above two things into a
  // database eventually . User balances has to be thrown into a database and what are the current trades that are happening
  // So these all the things will be thrown into the database slowly but the current order book and the current user balances
  // are always present here.
  ////////// What is an Engine ? ///////////////////////////
  /* A small summary of what is an engine
    A Engine is a core central server which mantains all the user balances and order books . You may get a doubt that
     What if there are hundred types of order books which means 100 different markets are there so we have to mantain 
     100 order books in this Engine as an inmemory . So at some point this Engine class needs to be a bunch of servers
     but not a single server (or) a bunch of multiple   golang (or) rust processes But as we are using node.js and it 
      is a single threaded and so we are keeping all the orderbooks inmemory . So this single Engine storing all the 
       order books and user balances as well  */
  private orderbooks: Orderbook[] = [];
  ////// Do we need seperate Redis queues for mantaining different order books ? /////////////
  /*  We can have a single redis queue where our single Engine(node.js process) which pulls from the Redis queue and 
   then the engine can delegate the  processing  to various order books . As the Engine is a central place to do 
     balance checks . Every orderbook can't have the current USDC balance (or) the ETH balance . As every order book
     can't have the USDC balance as should not be shared among multiple order books . So you need something on the top
     that does the balance checks and hence you need always the Engine  */
  private balances: Map<string, UserBalance> = new Map();

  constructor() {
    let snapshot = null;
    try {
      if (process.env.WITH_SNAPSHOT) {
        snapshot = fs.readFileSync("./snapshot.json");
      }
    } catch (e) {
      console.log("No snapshot found");
    }

    if (snapshot) {
      const snapshotSnapshot = JSON.parse(snapshot.toString());
      this.orderbooks = snapshotSnapshot.orderbooks.map(
        (o: any) =>
          new Orderbook(
            o.baseAsset,
            o.bids,
            o.asks,
            o.lastTradeId,
            o.currentPrice
          )
      );
      this.balances = new Map(snapshotSnapshot.balances);
    } else {
      this.orderbooks = [new Orderbook(`TATA`, [], [], 0, 0)];
      this.setBaseBalances();
    }
    setInterval(() => {
      this.saveSnapshot();
    }, 1000 * 3);
  }

  saveSnapshot() {
    const snapshotSnapshot = {
      orderbooks: this.orderbooks.map((o) => o.getSnapshot()),
      balances: Array.from(this.balances.entries()),
    };
    fs.writeFileSync("./snapshot.json", JSON.stringify(snapshotSnapshot));
  }

  process({
    // The user can send many messages here like create an order , cancel an order.
    message,
    clientId,
  }: {
    message: MessageFromApi;
    clientId: string;
  }) {
    switch (message.type) {
      case CREATE_ORDER:
        // whenever the create order message has come from the end user then we will call the below createOrder() function
        // once the createOrder() function has finished executing then it will return how much order has been
        // executed(executedQty) , how many exact fills that has been happened and the orderId
        try {
          const { executedQty, fills, orderId } = this.createOrder(
            message.data.market,
            message.data.price,
            message.data.quantity,
            message.data.side,
            message.data.userId
          );
          // Once the above createOrder() function is done , We will do  RedisManager.getInstance().sendToApi(clientId,{})
          // with the clientId
          RedisManager.getInstance().sendToApi(clientId, {
            type: "ORDER_PLACED",
            payload: {
              orderId,
              executedQty,
              fills,
            },
          });
        } catch (e) {
          console.log(e);
          RedisManager.getInstance().sendToApi(clientId, {
            type: "ORDER_CANCELLED",
            payload: {
              orderId: "",
              executedQty: 0,
              remainingQty: 0,
            },
          });
        }
        break;
      case CANCEL_ORDER:
        try {
          const orderId = message.data.orderId;
          const cancelMarket = message.data.market;
          const cancelOrderbook = this.orderbooks.find(
            (o) => o.ticker() === cancelMarket
          );
          const quoteAsset = cancelMarket.split("_")[1];
          if (!cancelOrderbook) {
            throw new Error("No orderbook found");
          }

          const order =
            cancelOrderbook.asks.find((o) => o.orderId === orderId) ||
            cancelOrderbook.bids.find((o) => o.orderId === orderId);
          if (!order) {
            console.log("No order found");
            throw new Error("No order found");
          }

          if (order.side === "buy") {
            const price = cancelOrderbook.cancelBid(order);
            const leftQuantity = (order.quantity - order.filled) * order.price;
            //@ts-ignore
            this.balances.get(order.userId)[BASE_CURRENCY].available +=
              leftQuantity;
            //@ts-ignore
            this.balances.get(order.userId)[BASE_CURRENCY].locked -=
              leftQuantity;
            if (price) {
              this.sendUpdatedDepthAt(price.toString(), cancelMarket);
            }
          } else {
            const price = cancelOrderbook.cancelAsk(order);
            const leftQuantity = order.quantity - order.filled;
            //@ts-ignore
            this.balances.get(order.userId)[quoteAsset].available +=
              leftQuantity;
            //@ts-ignore
            this.balances.get(order.userId)[quoteAsset].locked -= leftQuantity;
            if (price) {
              this.sendUpdatedDepthAt(price.toString(), cancelMarket);
            }
          }

          RedisManager.getInstance().sendToApi(clientId, {
            type: "ORDER_CANCELLED",
            payload: {
              orderId,
              executedQty: 0,
              remainingQty: 0,
            },
          });
        } catch (e) {
          console.log("Error hwile cancelling order");
          console.log(e);
        }
        break;
      case GET_OPEN_ORDERS:
        // If the user wants to see all the current orders that are present on the order book then he can choose the type
        // this case
        try {
          const openOrderbook = this.orderbooks.find(
            (o) => o.ticker() === message.data.market
          );
          if (!openOrderbook) {
            throw new Error("No orderbook found");
          }
          const openOrders = openOrderbook.getOpenOrders(message.data.userId);

          RedisManager.getInstance().sendToApi(clientId, {
            type: "OPEN_ORDERS",
            payload: openOrders,
          });
        } catch (e) {
          console.log(e);
        }
        break;
      case ON_RAMP: // Incase the user has paid some money then his balance should go up
        const userId = message.data.userId;
        const amount = Number(message.data.amount);
        this.onRamp(userId, amount);
        break;
      case GET_DEPTH: // When the user wants to know the current order book then they will send the function to the engine
        // and then the engine will finally respond to the api call send by the user to know the current order book
        try {
          const market = message.data.market;
          const orderbook = this.orderbooks.find((o) => o.ticker() === market);
          if (!orderbook) {
            throw new Error("No orderbook found");
          }
          RedisManager.getInstance().sendToApi(clientId, {
            type: "DEPTH",
            payload: orderbook.getDepth(),
          });
        } catch (e) {
          console.log(e);
          RedisManager.getInstance().sendToApi(clientId, {
            type: "DEPTH",
            payload: {
              bids: [],
              asks: [],
            },
          });
        }
        break;
    }
  }

  addOrderbook(orderbook: Orderbook) {
    this.orderbooks.push(orderbook);
  }

  createOrder(
    market: string,
    price: string,
    quantity: string,
    side: "buy" | "sell",
    userId: string
  ) {
    const orderbook = this.orderbooks.find((o) => o.ticker() === market); // It first gets the order book as we already
    // know that the Engine will mantain multiple order books which means multiple markets as one market for every order
    // book
    const baseAsset = market.split("_")[0]; // We will get the base asset
    const quoteAsset = market.split("_")[1]; // We will get the quote asset

    if (!orderbook) {
      throw new Error("No orderbook found");
    }

    //// First thing you have to do before going to the order book ? /////////////////
    /* You have to check and lock the funds of the user. let us take a small example to understand ,
     Let us say the user has 100USDC as the balance in his/her wallet and he wants to buy SOLANA for 20USDC
     then you need to make sure that the user has only 80USDC is available now and the 20USDC has gone to the order 
     book. If a user has placed a order of 20USDC then you have to lock 20USDC from the user's balance and this locked
     20USDC might exist on the order book (or) the order might get matched as well and if the order gets matched 
      we can unlock the balance . But before you place any order on the order book we must have to lock the user's
      balance else the user might place two orders with the same request of spending 20USDC twice and we make sure
      that it should not happen  */

    this.checkAndLockFunds(
      baseAsset,
      quoteAsset,
      side,
      userId,
      quoteAsset,
      price,
      quantity
    ); // Here you are locking the user's balances

    const order: Order = {
      price: Number(price),
      quantity: Number(quantity),
      orderId:
        Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15),
      filled: 0,
      side,
      userId,
    }; // Here the order book will handle how many orders are placed , filled and how many orders are executed
    // etc...

    const { fills, executedQty } = orderbook.addOrder(order);
    ///// The above addOrder(order) function is the main function which will do all the things related to order /////
    /* The above addOrder(order) function will do all the math figuring out how much of the user's order
     can get filled and how much of the user's order can't get filled. Whatever the order is not filled is
      placed on the order book . Let us say if i placed a order that is really very big then i will eat up the
      entire order book and whatever the order that we can't able to fullfil will be placed on the order book */
    this.updateBalance(userId, baseAsset, quoteAsset, side, fills, executedQty); // After the order has
    // successfully placed then you have to reUpdate the balance of the user. Based on the fills that were happened
    // we will update the user's balance.

    /* The below four functions are simply publishing the trades to various places */
    this.createDbTrades(fills, market, userId);
    this.updateDbOrders(order, executedQty, fills, market);
    this.publisWsDepthUpdates(fills, price, side, market);
    this.publishWsTrades(fills, userId, market); // Here we are publishing the trades to the websocket server.
    return { executedQty, fills, orderId: order.orderId };
  }

  updateDbOrders(
    order: Order,
    executedQty: number,
    fills: Fill[],
    market: string
  ) {
    RedisManager.getInstance().pushMessage({
      type: ORDER_UPDATE,
      data: {
        orderId: order.orderId,
        executedQty: executedQty,
        market: market,
        price: order.price.toString(),
        quantity: order.quantity.toString(),
        side: order.side,
      },
    });

    fills.forEach((fill) => {
      RedisManager.getInstance().pushMessage({
        type: ORDER_UPDATE,
        data: {
          orderId: fill.markerOrderId,
          executedQty: fill.qty,
        },
      });
    });
  }

  createDbTrades(fills: Fill[], market: string, userId: string) {
    fills.forEach((fill) => {
      RedisManager.getInstance().pushMessage({
        type: TRADE_ADDED,
        data: {
          market: market,
          id: fill.tradeId.toString(),
          isBuyerMaker: fill.otherUserId === userId, // TODO: Is this right?
          price: fill.price,
          quantity: fill.qty.toString(),
          quoteQuantity: (fill.qty * Number(fill.price)).toString(),
          timestamp: Date.now(),
        },
      });
    });
  }

  publishWsTrades(fills: Fill[], userId: string, market: string) {
    fills.forEach((fill) => {
      RedisManager.getInstance().publishMessage(`trade@${market}`, {
        stream: `trade@${market}`,
        data: {
          e: "trade",
          t: fill.tradeId,
          m: fill.otherUserId === userId, // TODO: Is this right?
          p: fill.price,
          q: fill.qty.toString(),
          s: market,
        },
      });
    });
  }

  sendUpdatedDepthAt(price: string, market: string) {
    const orderbook = this.orderbooks.find((o) => o.ticker() === market);
    if (!orderbook) {
      return;
    }
    const depth = orderbook.getDepth();
    const updatedBids = depth?.bids.filter((x) => x[0] === price);
    const updatedAsks = depth?.asks.filter((x) => x[0] === price);

    RedisManager.getInstance().publishMessage(`depth@${market}`, {
      stream: `depth@${market}`,
      data: {
        a: updatedAsks.length ? updatedAsks : [[price, "0"]],
        b: updatedBids.length ? updatedBids : [[price, "0"]],
        e: "depth",
      },
    });
  }

  publisWsDepthUpdates(
    fills: Fill[],
    price: string,
    side: "buy" | "sell",
    market: string
  ) {
    const orderbook = this.orderbooks.find((o) => o.ticker() === market);
    if (!orderbook) {
      return;
    }
    const depth = orderbook.getDepth();
    if (side === "buy") {
      const updatedAsks = depth?.asks.filter((x) =>
        fills.map((f) => f.price).includes(x[0].toString())
      );
      const updatedBid = depth?.bids.find((x) => x[0] === price);
      console.log("publish ws depth updates");
      RedisManager.getInstance().publishMessage(`depth@${market}`, {
        stream: `depth@${market}`,
        data: {
          a: updatedAsks,
          b: updatedBid ? [updatedBid] : [],
          e: "depth",
        },
      });
    }
    if (side === "sell") {
      const updatedBids = depth?.bids.filter((x) =>
        fills.map((f) => f.price).includes(x[0].toString())
      );
      const updatedAsk = depth?.asks.find((x) => x[0] === price);
      console.log("publish ws depth updates");
      RedisManager.getInstance().publishMessage(`depth@${market}`, {
        stream: `depth@${market}`,
        data: {
          a: updatedAsk ? [updatedAsk] : [],
          b: updatedBids,
          e: "depth",
        },
      });
    }
  }

  updateBalance(
    userId: string,
    baseAsset: string,
    quoteAsset: string,
    side: "buy" | "sell",
    fills: Fill[],
    executedQty: number
  ) {
    if (side === "buy") {
      fills.forEach((fill) => {
        // Update quote asset balance
        //@ts-ignore
        this.balances.get(fill.otherUserId)[quoteAsset].available =
          this.balances.get(fill.otherUserId)?.[quoteAsset].available +
          fill.qty * fill.price;

        //@ts-ignore
        this.balances.get(userId)[quoteAsset].locked =
          this.balances.get(userId)?.[quoteAsset].locked -
          fill.qty * fill.price;

        // Update base asset balance

        //@ts-ignore
        this.balances.get(fill.otherUserId)[baseAsset].locked =
          this.balances.get(fill.otherUserId)?.[baseAsset].locked - fill.qty;

        //@ts-ignore
        this.balances.get(userId)[baseAsset].available =
          this.balances.get(userId)?.[baseAsset].available + fill.qty;
      });
    } else {
      fills.forEach((fill) => {
        // Update quote asset balance
        //@ts-ignore
        this.balances.get(fill.otherUserId)[quoteAsset].locked =
          this.balances.get(fill.otherUserId)?.[quoteAsset].locked -
          fill.qty * fill.price;

        //@ts-ignore
        this.balances.get(userId)[quoteAsset].available =
          this.balances.get(userId)?.[quoteAsset].available +
          fill.qty * fill.price;

        // Update base asset balance

        //@ts-ignore
        this.balances.get(fill.otherUserId)[baseAsset].available =
          this.balances.get(fill.otherUserId)?.[baseAsset].available + fill.qty;

        //@ts-ignore
        this.balances.get(userId)[baseAsset].locked =
          this.balances.get(userId)?.[baseAsset].locked - fill.qty;
      });
    }
  }

  checkAndLockFunds(
    baseAsset: string,
    quoteAsset: string,
    side: "buy" | "sell",
    userId: string,
    asset: string,
    price: string,
    quantity: string
  ) {
    if (side === "buy") {
      // If the user is trying to buy an order then we make sure that the user has sufficient balance to
      // place the order . The below Number(price) is PricePerUnit . Let us take an example to understand this clearly..
      // let us say the price i am willing to buy solana is "141.55" per solana and the quantity of solana i want to
      // buy is "20". So how much USDC i need is "141.55 * 20" = "2831 USDC" . So this is the final USDC balance that
      // user should had which is 2831 USDC before buying a quantity of 20 solana according to the above example.
      // If the user didn't had 2831 USDC then we will simply reject the order with the response as "Insufficient funds"
      if (
        (this.balances.get(userId)?.[quoteAsset]?.available || 0) <
        Number(quantity) * Number(price)
      ) {
        throw new Error("Insufficient funds");
      }
      //@ts-ignore
      this.balances.get(userId)[quoteAsset].available =
        this.balances.get(userId)?.[quoteAsset].available -
        Number(quantity) * Number(price); // Here it decreases the available balance of the user and places the
      // user order onto the order book

      //@ts-ignore
      this.balances.get(userId)[quoteAsset].locked =
        this.balances.get(userId)?.[quoteAsset].locked +
        Number(quantity) * Number(price); // Here it increases the locked balance of the user and places the
      // user order onto the order book
    } else {
      if (
        (this.balances.get(userId)?.[baseAsset]?.available || 0) <
        Number(quantity)
      ) {
        throw new Error("Insufficient funds");
      }
      //@ts-ignore
      this.balances.get(userId)[baseAsset].available =
        this.balances.get(userId)?.[baseAsset].available - Number(quantity);

      //@ts-ignore
      this.balances.get(userId)[baseAsset].locked =
        this.balances.get(userId)?.[baseAsset].locked + Number(quantity);
    }
  }

  onRamp(userId: string, amount: number) {
    const userBalance = this.balances.get(userId);
    if (!userBalance) {
      this.balances.set(userId, {
        [BASE_CURRENCY]: {
          available: amount,
          locked: 0,
        },
      });
    } else {
      userBalance[BASE_CURRENCY].available += amount;
    }
  }

  setBaseBalances() {
    this.balances.set("1", {
      [BASE_CURRENCY]: {
        available: 10000000,
        locked: 0,
      },
      TATA: {
        available: 10000000,
        locked: 0,
      },
    });

    this.balances.set("2", {
      [BASE_CURRENCY]: {
        available: 10000000,
        locked: 0,
      },
      TATA: {
        available: 10000000,
        locked: 0,
      },
    });

    this.balances.set("5", {
      [BASE_CURRENCY]: {
        available: 10000000,
        locked: 0,
      },
      TATA: {
        available: 10000000,
        locked: 0,
      },
    });
  }
}
