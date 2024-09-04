"use client";

import { useEffect, useState } from "react";
import {
  getDepth,
  getKlines,
  getTicker,
  getTrades,
} from "../../utils/httpClient";
import { BidTable } from "./BidTable";
import { AskTable } from "./AskTable";
import { SignalingManager } from "@/app/utils/SignalingManager";

/// Here the market is "SOL_USDC"
export function Depth({ market }: { market: string }) {
  const [bids, setBids] = useState<[string, string][]>();
  const [asks, setAsks] = useState<[string, string][]>();
  const [price, setPrice] = useState<string>();

  useEffect(() => {
    // We are making the "depth" component real time by updating the asks and bids that came from ws.exchange backend data.
    SignalingManager.getInstance().registerCallback(
      "depth", // Whenever the depth changes (or) whenever the server gets the depth event then update the bids and asks.
      // Whenever we are registering a callback function then it will put something on the callbacks {} variable
      (data: any) => {
        console.log(data);
        // setBids(data.bids);
        setBids((originalBids) => {
          const bidsAfterUpdate = [...(originalBids || [])]; // newBids is the copy of the originaBids array
          for (let i = 0; i < bidsAfterUpdate.length; i++) {
            // I am iterating over all the new bids
            for (let j = 0; j < data.bids.length; j++) {
              if (bidsAfterUpdate[i][0] === data.bids[j][0]) {
                // Is there any new bid came from the backend (or) Did the backend returned me the [price,quantity] pair
                // such that the price is same as the price of bid that i have
                bidsAfterUpdate[i][1] = data.bids[j][1]; // We are updating the price of the bid
                break;
              }
            }
          }

          return bidsAfterUpdate; // We are returning the updated Bids if anything changes in the backend
        });
        // setAsks(data.asks);

        setAsks((originalAsks) => {
          const asksAfterUpdate = [...(originalAsks || [])]; // newAsks is the copy of the originalAsks array
          //// Why we are copying the originalAsks to a new Array ? /////
          /* Because you should not mutate the state variables ever . And if you ever mutate a state variable then it 
           didn't know that the state variable has changed as originalAsks refer to the same variable . So you may not
            see a rerender as it may happen sometimes and it may not happen sometimes*/
          for (let i = 0; i < asksAfterUpdate.length; i++) {
            // I am iterating over all the new Asks
            for (let j = 0; j < data.bids.length; j++) {
              if (asksAfterUpdate[i][0] === data.bids[j][0]) {
                // Is there any new ask came from the backend (or) Did the backend returned me the [price,quantity] pair with
                // the same price and quantity has changed then you update the quantity and return it
                // such that the price is same as the price of ask that i have
                asksAfterUpdate[i][1] = data.bids[j][1]; // We are updating the price of the ask
                break;
              }
            }
          }

          return asksAfterUpdate; // We are returning the updated asks if anything changes in the backend
        });
      },
      `DEPTH-${market}` // Here we are giving a different Id when we are registering a callback
    );
    SignalingManager.getInstance().sendMessage({
      method: "SUBSCRIBE",
      params: [`depth.200ms.${market}`],
    }); // I want to recieve all the depth updates from this market by subscribing to it
    getDepth(market).then((d) => {
      setBids(d.bids.reverse());
      setAsks(d.asks);
    });

    getTicker(market).then((t) => setPrice(t.lastPrice));
    // getTrades(market).then(t => setPrice(t[0].price));
    // getKlines(market, "1h", 1640099200, 1640100800).then(t => setPrice(t[0].close));
    return () => {
      SignalingManager.getInstance().sendMessage({
        method: "UNSUBSCRIBE",
        params: [`depth.200ms.${market}`],
      });
      SignalingManager.getInstance().deRegisterCallback(
        "depth",
        `DEPTH-${market}` // Here we are giving a different Id when we are deregistering a callback
      );
    };
  }, []);

  return (
    <div>
      <TableHeader />
      {asks && <AskTable asks={asks} />}
      {price && <div>{price}</div>}
      {bids && <BidTable bids={bids} />}
    </div>
  );
}

function TableHeader() {
  return (
    <div className="flex justify-between text-xs">
      <div className="text-white">Price</div>
      <div className="text-slate-500">Size</div>
      <div className="text-slate-500">Total</div>
    </div>
  );
}
