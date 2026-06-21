"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function NewTrade() {
  const [broker, setBroker] = useState("");
  const [symbol, setSymbol] = useState("");
  const [direction, setDirection] = useState("LONG");

  const [entryPrice, setEntryPrice] = useState("");
  const [exitPrice, setExitPrice] = useState("");

  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");

  const [strategy, setStrategy] = useState("");
  const [setupScore, setSetupScore] = useState("");
  const [notes, setNotes] = useState("");

  const [screenshot, setScreenshot] =
    useState<File | null>(null);

  const pnl =
    direction === "LONG"
      ? Number(exitPrice || 0) -
        Number(entryPrice || 0)
      : Number(entryPrice || 0) -
        Number(exitPrice || 0);

  const returnPct =
    Number(entryPrice) > 0
      ? Number(
          (
            (pnl / Number(entryPrice)) *
            100
          ).toFixed(2)
        )
      : 0;

  const risk =
    direction === "LONG"
      ? Number(entryPrice || 0) -
        Number(stopLoss || 0)
      : Number(stopLoss || 0) -
        Number(entryPrice || 0);

  const reward =
    direction === "LONG"
      ? Number(takeProfit || 0) -
        Number(entryPrice || 0)
      : Number(entryPrice || 0) -
        Number(takeProfit || 0);

  const rr =
    risk > 0
      ? Number((reward / risk).toFixed(2))
      : 0;

  async function handleSave() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("Niet ingelogd");
      return;
    }

    let screenshotUrl = "";

    if (screenshot) {
      const fileName =
        `${Date.now()}-${screenshot.name}`;

      const { error: uploadError } =
        await supabase.storage
          .from("trade-screenshots")
          .upload(fileName, screenshot);

      if (uploadError) {
        console.error(uploadError);

        alert(
          JSON.stringify(
            uploadError,
            null,
            2
          )
        );

        return;
      }

      const { data } = supabase.storage
        .from("trade-screenshots")
        .getPublicUrl(fileName);

      screenshotUrl = data.publicUrl;
    }

    const { error } = await supabase
      .from("trades")
      .insert([
        {
          user_id: user.id,

          symbol,
          direction,

          entry_price: Number(entryPrice),
          exit_price: Number(exitPrice),

          stop_loss: Number(stopLoss),
          take_profit: Number(takeProfit),

          pnl,
          return_pct: returnPct,
          rr,

          strategy,
          setup_score: Number(setupScore),

          followed_plan: true,

          notes,
          screenshot_url: screenshotUrl,
        },
      ]);

    if (error) {
      console.error(error);

      alert(
        JSON.stringify(error, null, 2)
      );

      return;
    }

    alert("Trade opgeslagen!");

    setBroker("");
    setSymbol("");
    setDirection("LONG");

    setEntryPrice("");
    setExitPrice("");

    setStopLoss("");
    setTakeProfit("");

    setStrategy("");
    setSetupScore("");
    setNotes("");

    setScreenshot(null);
  }

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <h1 className="text-5xl font-bold mb-10">
        Nieuwe Trade
      </h1>

      <div className="max-w-3xl space-y-6">
        <input
          value={broker}
          onChange={(e) =>
            setBroker(e.target.value)
          }
          placeholder="Broker"
          className="w-full bg-gray-900 p-5 rounded-xl"
        />

        <input
          value={symbol}
          onChange={(e) =>
            setSymbol(e.target.value)
          }
          placeholder="Symbool"
          className="w-full bg-gray-900 p-5 rounded-xl"
        />

        <select
          value={direction}
          onChange={(e) =>
            setDirection(e.target.value)
          }
          className="w-full bg-gray-900 p-5 rounded-xl"
        >
          <option value="LONG">LONG</option>
          <option value="SHORT">SHORT</option>
        </select>

        <input
          type="number"
          value={entryPrice}
          onChange={(e) =>
            setEntryPrice(e.target.value)
          }
          placeholder="Entry prijs"
          className="w-full bg-gray-900 p-5 rounded-xl"
        />

        <input
          type="number"
          value={stopLoss}
          onChange={(e) =>
            setStopLoss(e.target.value)
          }
          placeholder="Stop Loss"
          className="w-full bg-gray-900 p-5 rounded-xl"
        />

        <input
          type="number"
          value={takeProfit}
          onChange={(e) =>
            setTakeProfit(e.target.value)
          }
          placeholder="Take Profit"
          className="w-full bg-gray-900 p-5 rounded-xl"
        />

        <input
          type="number"
          value={exitPrice}
          onChange={(e) =>
            setExitPrice(e.target.value)
          }
          placeholder="Exit prijs"
          className="w-full bg-gray-900 p-5 rounded-xl"
        />

        <div className="bg-gray-900 p-5 rounded-xl">
          <p className="text-gray-400 text-sm">
            Verwachte PnL
          </p>

          <p className="text-green-400 text-3xl font-bold">
            {pnl}
          </p>

          <p className="text-gray-400 text-sm mt-4">
            Return %
          </p>

          <p className="text-green-400 text-2xl font-bold">
            {returnPct}%
          </p>

          <p className="text-gray-400 text-sm mt-4">
            Risk / Reward
          </p>

          <p className="text-blue-400 text-2xl font-bold">
            {rr}
          </p>
        </div>

        <input
          value={strategy}
          onChange={(e) =>
            setStrategy(e.target.value)
          }
          placeholder="Strategie"
          className="w-full bg-gray-900 p-5 rounded-xl"
        />

        <input
          type="number"
          value={setupScore}
          onChange={(e) =>
            setSetupScore(e.target.value)
          }
          placeholder="Setup score (1-10)"
          className="w-full bg-gray-900 p-5 rounded-xl"
        />

        <textarea
          value={notes}
          onChange={(e) =>
            setNotes(e.target.value)
          }
          placeholder="Notities"
          className="w-full bg-gray-900 p-5 rounded-xl h-32"
        />

        <div className="bg-gray-900 p-5 rounded-xl">
          <p className="mb-3 text-gray-400">
            Screenshot uploaden
          </p>

          <input
            type="file"
            accept="image/*"
            onChange={(e) =>
              setScreenshot(
                e.target.files?.[0] || null
              )
            }
          />
        </div>

        <button
          onClick={handleSave}
          className="bg-blue-600 px-8 py-4 rounded-xl"
        >
          Opslaan
        </button>
      </div>
    </main>
  );
}