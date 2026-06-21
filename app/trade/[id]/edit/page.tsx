"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useParams, useRouter } from "next/navigation";

export default function EditTrade() {
  const params = useParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  const [symbol, setSymbol] = useState("");
  const [direction, setDirection] = useState("LONG");
  const [entryPrice, setEntryPrice] = useState("");
  const [exitPrice, setExitPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [strategy, setStrategy] = useState("");
  const [setupScore, setSetupScore] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    loadTrade();
  }, []);

  async function loadTrade() {
    const { data, error } = await supabase
      .from("trades")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error || !data) {
      alert("Trade niet gevonden");
      return;
    }

    setSymbol(data.symbol || "");
    setDirection(data.direction || "LONG");
    setEntryPrice(String(data.entry_price || ""));
    setExitPrice(String(data.exit_price || ""));
    setStopLoss(String(data.stop_loss || ""));
    setTakeProfit(String(data.take_profit || ""));
    setStrategy(data.strategy || "");
    setSetupScore(String(data.setup_score || ""));
    setNotes(data.notes || "");

    setLoading(false);
  }

  const pnl =
    direction === "LONG"
      ? Number(exitPrice || 0) - Number(entryPrice || 0)
      : Number(entryPrice || 0) - Number(exitPrice || 0);

  const returnPct =
    Number(entryPrice) > 0
      ? Number(
          ((pnl / Number(entryPrice)) * 100).toFixed(2)
        )
      : 0;

  const rr =
    Number(entryPrice) > 0 &&
    Number(stopLoss) > 0 &&
    Number(takeProfit) > 0
      ? Number(
          (
            Math.abs(
              Number(takeProfit) - Number(entryPrice)
            ) /
            Math.abs(
              Number(entryPrice) - Number(stopLoss)
            )
          ).toFixed(2)
        )
      : 0;

  async function handleDelete() {
    const confirmed = confirm(
      "Weet je zeker dat je deze trade wilt verwijderen?"
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("trades")
      .delete()
      .eq("id", params.id);

    if (error) {
      console.error(error);
      alert("Verwijderen mislukt");
      return;
    }

    alert("Trade verwijderd");

    router.push("/");
  }

  async function handleUpdate() {
    const { error } = await supabase
      .from("trades")
      .update({
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
        notes,
      })
      .eq("id", params.id);

    if (error) {
      console.error(error);
      alert("Fout bij opslaan");
      return;
    }

    alert("Trade bijgewerkt!");

    router.push(`/trade/${params.id}`);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white p-8">
        Laden...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-8 max-w-4xl mx-auto">
      <h1 className="text-5xl font-bold mb-10">
        Edit Trade
      </h1>

      <div className="space-y-5">

        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder="Symbol"
          className="w-full bg-gray-900 p-4 rounded-xl"
        />

        <select
          value={direction}
          onChange={(e) => setDirection(e.target.value)}
          className="w-full bg-gray-900 p-4 rounded-xl"
        >
          <option value="LONG">LONG</option>
          <option value="SHORT">SHORT</option>
        </select>

        <input
          type="number"
          value={entryPrice}
          onChange={(e) => setEntryPrice(e.target.value)}
          placeholder="Entry"
          className="w-full bg-gray-900 p-4 rounded-xl"
        />

        <input
          type="number"
          value={exitPrice}
          onChange={(e) => setExitPrice(e.target.value)}
          placeholder="Exit"
          className="w-full bg-gray-900 p-4 rounded-xl"
        />

        <input
          type="number"
          value={stopLoss}
          onChange={(e) => setStopLoss(e.target.value)}
          placeholder="Stop Loss"
          className="w-full bg-gray-900 p-4 rounded-xl"
        />

        <input
          type="number"
          value={takeProfit}
          onChange={(e) => setTakeProfit(e.target.value)}
          placeholder="Take Profit"
          className="w-full bg-gray-900 p-4 rounded-xl"
        />

        <input
          value={strategy}
          onChange={(e) => setStrategy(e.target.value)}
          placeholder="Strategie"
          className="w-full bg-gray-900 p-4 rounded-xl"
        />

        <input
          type="number"
          value={setupScore}
          onChange={(e) => setSetupScore(e.target.value)}
          placeholder="Setup Score"
          className="w-full bg-gray-900 p-4 rounded-xl"
        />

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notities"
          className="w-full bg-gray-900 p-4 rounded-xl h-40"
        />

        <div className="bg-gray-900 p-5 rounded-xl">
          <p>PnL: {pnl}</p>
          <p>Return: {returnPct}%</p>
          <p>RR: {rr}</p>
        </div>

        <div className="flex gap-4">

          <button
            onClick={handleUpdate}
            className="bg-blue-600 hover:bg-blue-500 px-8 py-4 rounded-xl font-semibold"
          >
            Update Trade
          </button>

          <button
            onClick={handleDelete}
            className="bg-red-600 hover:bg-red-500 px-8 py-4 rounded-xl font-semibold"
          >
            Delete Trade
          </button>

        </div>

      </div>
    </main>
  );
}