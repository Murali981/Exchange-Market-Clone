import { useEffect, useRef } from "react";
import { ChartManager } from "../utils/ChartManager";
import { getKlines } from "../utils/httpClient";
import { KLine } from "../utils/types";

export function TradeView({ market }: { market: string }) {
  const chartRef = useRef<HTMLDivElement>(null); // Here we refering to a HTML <div> element and we are initializing
  // the chartRef to "null"
  const chartManagerRef = useRef<ChartManager>(null);

  ////////// What Ref's are ?  /////////////////////////////
  /* Ref's lets you do two things  , One thing is they let you to attach to a div element where it let's you get a 
    reference to a <div> element  and another thing you will use the ref's for  is for storing any variables  across the
     renders */

  const init = async () => {
    let klineData: KLine[] = [];
    try {
      klineData = await getKlines(
        market,
        "1h", // We are getting the hourly data from the backend
        Math.floor((new Date().getTime() - 1000 * 60 * 60 * 24 * 7) / 1000), // new Date().getTime() will give you the current
        // time - 1000 * 60 * 60 * 24 * 7 (60 * 60 = 3600sec which is one hour and then * 24 which is 1 day  and then * 7 which is
        // one week) So give me all the data for the last one week
        Math.floor(new Date().getTime() / 1000) // Till today in a hourly fashion(1h) for the "market"(SOL_USDC) then i will get
        // all the KLine data . Once getting all the klineData , create a new ChartManager() with the provided klinesData in a format
        // it will understand . Unfortunately the backend of any exchange will return you string data. "x.close" will tell you
        // where this specific week close . Even though it should be the number , you get strings from the backend to avoid the
        // precision errors . But if you send a string to the chart manager (or) to the "light-weights" chart library then it
        // will give you an error that's why we have parse it down to a float and convert it into a number using the parseFloat()
        // function and then the timestamp that where did this specific week has ended and then sort it based on the timestamp to
        // make sure that incase the backend didn't return you the data in a sorted order. So you will give the sorted data
        // to the ChartManager()
      );
      console.log(klineData);
    } catch (e) {}

    if (chartRef) {
      if (chartManagerRef.current) {
        chartManagerRef.current.destroy();
      }
      const chartManager = new ChartManager( // We have initialized the chart manager here where this
        // ChartManager() comes from the path "../utils/ChartManager" and this "ChartManager" file (or) abstraction is created
        // on top of the trading-view library (or) the "lightweight-charts" library and this ChartManager file is created to
        // easily pass the candle-data
        chartRef.current,
        [
          ...klineData?.map((x) => ({
            close: parseFloat(x.close),
            high: parseFloat(x.high),
            low: parseFloat(x.low),
            open: parseFloat(x.open),
            timestamp: new Date(x.end),
          })),
        ].sort((x, y) => (x.timestamp < y.timestamp ? -1 : 1)) || [],
        {
          background: "#0e0f14",
          color: "white",
        }
      );
      //@ts-ignore
      chartManagerRef.current = chartManager;
    }
  };

  useEffect(() => {
    init();
  }, [market, chartRef]); // Whenever the market changes (or) the reference to the chart (chartRef) changes means
  // when the <div> changes because the chartRef references to the <div> element , Let us suppose when we moved from
  // one market(SOL_USDC) to another market(ETH_USDC) then the <div> element on the DOM changes which is referred by the
  // chartRef reference element then i should recreate the chart (or) rerender the chart again where this useEffect() hook
  // will be called again

  return (
    <>
      <div
        ref={chartRef}
        // Here the chartRef variable is getting a reference to the <div> element
        style={{ height: "520px", width: "100%", marginTop: 4 }}
      ></div>
    </>
  );
}
