import { Depth } from "../components/depth/Depth";
import { Ticker } from "./types";

export const BASE_URL = "wss://ws.backpack.exchange/"; // This is the exchange that we are trying to connect

export class SignalingManager {
  // We have created a SignallingManager class which is a singleton .
  // What is a Singleton ? ///////////////
  // A class which has a private constructor is called a singleton
  // If it is a private constructor , We can't create multiple instances and this is the behaviour we wan't exactly
  // That only a single websocket connection has to be made that's why we are making this SignalingManager class a Singleton ///
  private ws: WebSocket;
  private static instance: SignalingManager;
  private bufferedMessages: any[] = [];
  private callbacks: any = {};
  private id: number;
  private initialized: boolean = false;
  // All the above are attributes that are attached to the object of the SignalingManager class

  private constructor() {
    /// This constructor will create a websocket connection to either something that comes as an input (or) to the
    // the BASE_URL. The problem with the websocket connection is , It will take sometime for the connection to be established.
    // And if someone tries to call SignalingManager.getInstance().sendMessage() then the websocket will throw an error. For this reason
    // we will initialize the bufferedMessages as an empty array [] because if someone tries to call the SignalingManager.getInstance().sendMessage()
    // without the websocket connection establishment then that sendMessage() function will send that (or) throw that message
    // into the bufferedMessages array
    this.ws = new WebSocket(BASE_URL); // A new websocket connection is created whenever the constructor() function is called
    this.bufferedMessages = [];
    this.id = 1; // Whenever you send the messages to a  server it will expect an id along with it
    this.init();
  }

  public static getInstance() {
    // This getInstance() function is a static function . So if it is a static function then this getInstance() function is
    // directly attached to the SignalingManager class but not to the instance of the SignalingManager class. So we can
    // directly call SignalingManager.getInstance()
    if (!this.instance) {
      this.instance = new SignalingManager();
    } // What this if condition will check is , If there is already an instance then it will not create a new instance but if
    // there is no instance then it will create a new instance by initializing it once . Now it is not matter that how many
    // times we call the SignalingManager.getInstance() , It will keep returning me the old instance/
    return this.instance;
    ///// Why we have to keep SignalingManager class a Singleton ? //////////////////////
    /* The easier logic is , Create a fresh websocket connection and connect to the backend and just subscribe the depth from here
      and again create a second websocket connection  and subscribe to the KLine data to get the graph and again create another
       fresh websocket connection and subscribe to the ticker data from this websocket connection . But this is a ugly logic
        where the user can subscribe to multiple streams of data by creating a single websocket connection.*/
  }

  init() {
    this.ws.onopen = () => {
      // once the websocket connection has successfully happened then we will iterate over all the buffered messages
      // and send all the messages over the wire.
      this.initialized = true;
      this.bufferedMessages.forEach((message) => {
        this.ws.send(JSON.stringify(message));
      });
      this.bufferedMessages = [];
    };
    this.ws.onmessage = (event) => {
      /// When you recieve a message from the server then we have to forward that received message to a component .
      // There are three separate react components (Depth , Tradeview and Ticker) has to subscribe to some data.
      // Every component has to get the data from a single websocket connection where all the three components has
      // subscribed to separate data (or) events . This is the reason we have the callback() functions which are
      // written below . So please refer them.
      const message = JSON.parse(event.data);
      const type = message.data.e;
      if (this.callbacks[type]) {
        // If a callback is waiting for this "ticker" event then for all the callbacks
        this.callbacks[type].forEach(({ callback }) => {
          if (type === "ticker") {
            // Whenever a message comes now and if it is of the type "ticker" then you will call the callback() with that data.
            // You will create a new ticker variable with lastPrice , high , low , volume , quoteVolume , symbol. You will
            // just change the shape of the backend as what shape the backend gives you to a more understandable shape that
            // your frontend understands. For example the backend gives you c(message.data.c) which is the closing price so you
            // are replacing that "c" with the lastPrice variable. You change this backend receiving data according to the
            // <Ticker> type data you have on the frontend
            const newTicker: Partial<Ticker> = {
              lastPrice: message.data.c,
              high: message.data.h,
              low: message.data.l,
              volume: message.data.v,
              quoteVolume: message.data.V,
              symbol: message.data.s,
            };

            callback(newTicker); // This callback(newTicker) function is called with updated ticker data
          }
          if (type === "depth") {
            // const newTicker: Partial<Ticker> = {
            //   lastPrice: message.data.c,
            //   high: message.data.h,
            //   low: message.data.l,
            //   volume: message.data.v,
            //   quoteVolume: message.data.V,
            //   symbol: message.data.s,
            // };
            // console.log(newTicker);
            // callback(newTicker);
            const updatedBids = message.data.b;
            const updatedAsks = message.data.a;
            callback({ bids: updatedBids, asks: updatedAsks });
          }
        });
      }
    };
  }

  sendMessage(message: any) {
    const messageToSend = {
      ...message,
      id: this.id++,
    };
    if (!this.initialized) {
      this.bufferedMessages.push(messageToSend);
      return;
    }
    this.ws.send(JSON.stringify(messageToSend));
  }

  ///////////// What does the below registerCallback() function do ? ////////////////////
  /* It takes the callback attribute that we had declared above . The type of the callback is simply an empty object
  {}  It will keep track of  which component wants to access what data field*/

  async registerCallback(type: string, callback: any, id: string) {
    this.callbacks[type] = this.callbacks[type] || [];
    this.callbacks[type].push({ callback, id });
    // If someone has subscribed to "ticker" event then the ticker event related callBack() should be called. If a
    // "ticker" event comes from the server then the ticker event callback function should be called.
    // this.callbacks["ticker"].push({this ticker event specific callback , along it will also store "id"})
    // Why do you want to receive an "id" to the registerCallback() function. Whenever the specific ticker event component
    // unmounts then you can deregister the callback() function for that specific Id.
    // "ticker" => callback
  }

  async deRegisterCallback(type: string, id: string) {
    if (this.callbacks[type]) {
      // Is there any callback of type depth  , If there is a callback of type "depth" then it finds the
      // index of the depth using the below findIndex() function
      const index = this.callbacks[type].findIndex(
        (callback) => callback.id === id
      );
      if (index !== -1) {
        // If there is a callback then remove that callback and this is what the below splice() does
        this.callbacks[type].splice(index, 1);
      }
    }
  }
}
