// "use client";
// import { useEffect, useState } from "react";
// import { Ticker } from "../utils/types";
// import { getTicker } from "../utils/httpClient";

// export const MarketBar = ({ market }: { market: string }) => {
//   const [ticker, setTicker] = useState<Ticker | null>(null);

//   useEffect(() => {
//     getTicker(market).then(setTicker);
//   }, [market]);

//   return (
//     <div>
//       <div className="flex items-center flex-row relative w-full overflow-hidden border-b border-slate-800">
//         <div className="flex items-center justify-between flex-row no-scrollbar overflow-auto pr-4">
//           <Ticker market={market} />
//           <div className="flex items-center flex-row space-x-8 pl-4">
//             <div className="flex flex-col h-full justify-center">
//               <p
//                 className={`font-medium tabular-nums  text-greenText text-md text-green-500`}
//               >
//                 ${ticker?.lastPrice}
//               </p>
//               <p className="font-medium text-sm text-white tabular-nums">
//                 ${ticker?.lastPrice}
//               </p>
//             </div>
//             <div className="flex flex-col">
//               <p className={`font-medium text-xs text-slate-400 text-sm`}>
//                 24H Change
//               </p>
//               <p
//                 className={` text-sm font-medium tabular-nums leading-5 text-sm text-greenText ${
//                   Number(ticker?.priceChange) > 0
//                     ? "text-green-500"
//                     : "text-red-500"
//                 }`}
//               >
//                 {Number(ticker?.priceChange) > 0 ? "+" : ""}{" "}
//                 {ticker?.priceChange}{" "}
//                 {Number(ticker?.priceChangePercent)?.toFixed(2)}%
//               </p>
//             </div>
//             <div className="flex flex-col">
//               <p className="font-medium text-xs text-slate-400 text-sm">
//                 24H High
//               </p>
//               <p className="text-sm font-medium tabular-nums leading-5 text-sm ">
//                 {ticker?.high}
//               </p>
//             </div>
//             <div className="flex flex-col">
//               <p className="font-medium text-xs text-slate-400 text-sm">
//                 24H Low
//               </p>
//               <p className="text-sm font-medium tabular-nums leading-5 text-sm ">
//                 {ticker?.low}
//               </p>
//             </div>
//             <button
//               type="button"
//               className="font-medium transition-opacity hover:opacity-80 hover:cursor-pointer text-base text-left"
//               data-rac=""
//             >
//               <div className="flex flex-col">
//                 <p className="font-medium text-xs text-slate-400 text-sm">
//                   24H Volume
//                 </p>
//                 <p className="mt-1 text-sm font-medium tabular-nums leading-5 text-sm ">
//                   {ticker?.volume}
//                 </p>
//               </div>
//             </button>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// function Ticker({ market }: { market: string }) {
//   return (
//     <div className="flex h-[60px] shrink-0 space-x-4">
//       <div className="flex flex-row relative ml-2 -mr-4">
//         <img
//           alt="SOL Logo"
//           loading="lazy"
//           decoding="async"
//           data-nimg="1"
//           className="z-10 rounded-full h-6 w-6 mt-4 outline-baseBackgroundL1"
//           src="/sol.webp"
//         />
//         <img
//           alt="USDC Logo"
//           loading="lazy"
//           decoding="async"
//           data-nimg="1"
//           className="h-6 w-6 -ml-2 mt-4 rounded-full"
//           src="/usdc.webp"
//         />
//       </div>
//       <button type="button" className="react-aria-Button" data-rac="">
//         <div className="flex items-center justify-between flex-row cursor-pointer rounded-lg p-3 hover:opacity-80">
//           <div className="flex items-center flex-row gap-2 ">
//             <div className="flex flex-row relative">
//               <p className="font-medium text-sm  text-white ">
//                 {market.replace("_", " / ")}
//               </p>
//             </div>
//           </div>
//         </div>
//       </button>
//     </div>
//   );
// }

//// To get the real time data from the websocket server ////////////////////////////

"use client";
import { useEffect, useState } from "react";
import { Ticker } from "../utils/types";
import { getTicker } from "../utils/httpClient";
import { SignalingManager } from "../utils/SignalingManager";

export const MarketBar = ({ market }: { market: string }) => {
  const [ticker, setTicker] = useState<Ticker | null>(null);

  useEffect(() => {
    getTicker(market).then(setTicker); // I am getting the ticker and setting the details
    /////////// What is the below one is doing ? ///////////////////////
    /* It is registering a callback on the signalling manager . So it is telling that whenever the server returns 
     you some ticker data then please give it to me which means the ticker has been updated so that i have to
      update the setTicker() state variable. This is very clean flow  to have a single websocket manager (or) a 
      SignalingManger class  that connects to our server and forwards the data to the right  component . If you
       create a websocket connection for the first time where you will initialize a fresh websocket connection and do 
       a websocket.on whenever a message comes */
    SignalingManager.getInstance().registerCallback(
      "ticker",
      (data: Partial<Ticker>) =>
        setTicker((prevTicker) => ({
          firstPrice: data?.firstPrice ?? prevTicker?.firstPrice ?? "", // If a new data came from the backend then
          // update with that new data (data?.firstPrice ) (or) if no data came from the backend then update with the old data which is
          //  (prevTicker?.firstPrice) (or) if the existing data is also not there then we have an empty string.
          high: data?.high ?? prevTicker?.high ?? "",
          lastPrice: data?.lastPrice ?? prevTicker?.lastPrice ?? "",
          low: data?.low ?? prevTicker?.low ?? "",
          priceChange: data?.priceChange ?? prevTicker?.priceChange ?? "",
          priceChangePercent:
            data?.priceChangePercent ?? prevTicker?.priceChangePercent ?? "",
          quoteVolume: data?.quoteVolume ?? prevTicker?.quoteVolume ?? "",
          symbol: data?.symbol ?? prevTicker?.symbol ?? "",
          trades: data?.trades ?? prevTicker?.trades ?? "",
          volume: data?.volume ?? prevTicker?.volume ?? "",
        })),
      `TICKER-${market}` // Here also we are giving a different ID when we are registering for ticker data
    );
    SignalingManager.getInstance().sendMessage({
      method: "SUBSCRIBE",
      params: [`ticker.${market}`],
    }); // Here we are sending a subscribe event to the backend that we are subscribing to this specific market

    //// What does the below return will do inside the useEffect ? /////////////////
    /*  Whenever the market changes inside the useEffect() dependency array then the  getTicker(market) function
     will be called along with the  SignalingManager.getInstance().registerCallback() function will be called .
      Whenever this component rerenders (or) again the market variable in the dependency array changes then the 
      below return statement runs which is a cleanup logic and after the cleanup logic runs then the getTicker(market) function
     will be called along with the  SignalingManager.getInstance().registerCallback() function will be called again
     The below cleanup function which is returning will be  runned when the component unmounts (or) when the market 
      variable  changes again*/
    return () => {
      SignalingManager.getInstance().deRegisterCallback(
        "ticker",
        `TICKER-${market}` // Here also we are giving a different ID by "TICKER-${market}" when we are deregistering for ticker data
      ); // We are going to deregister from the ticker component
      SignalingManager.getInstance().sendMessage({
        method: "UNSUBSCRIBE",
        params: [`ticker.${market}`],
      }); // And also we are unsubscribing from that specific market.
    };
  }, [market]);
  //

  return (
    <div>
      <div className="flex items-center flex-row relative w-full overflow-hidden border-b border-slate-800">
        <div className="flex items-center justify-between flex-row no-scrollbar overflow-auto pr-4">
          <Ticker market={market} />
          <div className="flex items-center flex-row space-x-8 pl-4">
            <div className="flex flex-col h-full justify-center">
              <p
                className={`font-medium tabular-nums text-greenText text-md text-green-500`}
              >
                ${ticker?.lastPrice}
              </p>
              <p className="font-medium text-sm text-sm tabular-nums">
                ${ticker?.lastPrice}
              </p>
            </div>
            <div className="flex flex-col">
              <p className={`font-medium text-xs text-slate-400 text-sm`}>
                24H Change
              </p>
              <p
                className={` text-sm font-medium tabular-nums leading-5 text-sm text-greenText ${
                  Number(ticker?.priceChange) > 0
                    ? "text-green-500"
                    : "text-red-500"
                }`}
              >
                {Number(ticker?.priceChange) > 0 ? "+" : ""}{" "}
                {ticker?.priceChange}{" "}
                {Number(ticker?.priceChangePercent)?.toFixed(2)}%
              </p>
            </div>
            <div className="flex flex-col">
              <p className="font-medium text-xs text-slate-400 text-sm">
                24H High
              </p>
              <p className="text-sm font-medium tabular-nums leading-5 text-sm ">
                {ticker?.high}
              </p>
            </div>
            <div className="flex flex-col">
              <p className="font-medium text-xs text-slate-400 text-sm">
                24H Low
              </p>
              <p className="text-sm font-medium tabular-nums leading-5 text-sm ">
                {ticker?.low}
              </p>
            </div>
            <button
              type="button"
              className="font-medium transition-opacity hover:opacity-80 hover:cursor-pointer text-base text-left"
              data-rac=""
            >
              <div className="flex flex-col">
                <p className="font-medium text-xs text-slate-400 text-sm">
                  24H Volume
                </p>
                <p className="mt-1 text-sm font-medium tabular-nums leading-5 text-sm ">
                  {ticker?.volume}
                </p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

function Ticker({ market }: { market: string }) {
  return (
    <div className="flex h-[60px] shrink-0 space-x-4">
      <div className="flex flex-row relative ml-2 -mr-4">
        <img
          alt="SOL Logo"
          loading="lazy"
          decoding="async"
          data-nimg="1"
          className="z-10 rounded-full h-6 w-6 mt-4 outline-baseBackgroundL1"
          src="/sol.webp"
        />
        <img
          alt="USDC Logo"
          loading="lazy"
          decoding="async"
          data-nimg="1"
          className="h-6 w-6 -ml-2 mt-4 rounded-full"
          src="/usdc.webp"
        />
      </div>
      <button type="button" className="react-aria-Button" data-rac="">
        <div className="flex items-center justify-between flex-row cursor-pointer rounded-lg p-3 hover:opacity-80">
          <div className="flex items-center flex-row gap-2 undefined">
            <div className="flex flex-row relative">
              <p className="font-medium text-sm undefined">
                {market.replace("_", " / ")}
              </p>
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}
