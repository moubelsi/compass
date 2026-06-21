import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default async function TradePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: trade, error } = await supabase
    .from("trades")
    .select("*")
    .eq("id", id)
    .single();

  if (!trade) {
    return (
      <main className="min-h-screen bg-black text-white p-8">
        <h1 className="text-3xl font-bold text-red-500 mb-4">
          Trade niet gevonden
        </h1>

        <pre>{JSON.stringify(error, null, 2)}</pre>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-5xl font-bold">
            {trade.symbol}
          </h1>

          <p className="text-gray-400 mt-2">
            {trade.direction}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/trade/${trade.id}/edit`}
            className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-xl font-semibold text-white transition"
          >
            Edit Trade
          </Link>

          <Link
            href={`/trade/${trade.id}/delete`}
            className="inline-flex items-center justify-center bg-red-600 hover:bg-red-500 px-6 py-3 rounded-xl font-semibold text-white transition"
          >
            Delete Trade
          </Link>
        </div>
      </div>

      {trade.screenshot_url && (
        <div className="bg-gray-900 p-4 rounded-2xl mb-8">
          <img
            src={trade.screenshot_url}
            alt="Trade screenshot"
            className="w-full rounded-xl border border-gray-800"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-gray-900 p-6 rounded-2xl">
          <p className="text-gray-400">Entry</p>

          <p className="text-3xl font-bold mt-2">
            {trade.entry_price}
          </p>
        </div>

        <div className="bg-gray-900 p-6 rounded-2xl">
          <p className="text-gray-400">Exit</p>

          <p className="text-3xl font-bold mt-2">
            {trade.exit_price}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-gray-900 p-6 rounded-2xl">
          <p className="text-gray-400">Stop Loss</p>

          <p className="text-3xl font-bold mt-2">
            {trade.stop_loss || "-"}
          </p>
        </div>

        <div className="bg-gray-900 p-6 rounded-2xl">
          <p className="text-gray-400">Take Profit</p>

          <p className="text-3xl font-bold mt-2">
            {trade.take_profit || "-"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-900 p-6 rounded-2xl">
          <p className="text-gray-400">PnL</p>

          <p
            className={
              trade.pnl >= 0
                ? "text-green-400 text-4xl font-bold mt-2"
                : "text-red-400 text-4xl font-bold mt-2"
            }
          >
            {trade.pnl}
          </p>
        </div>

        <div className="bg-gray-900 p-6 rounded-2xl">
          <p className="text-gray-400">Return %</p>

          <p
            className={
              trade.return_pct >= 0
                ? "text-green-400 text-4xl font-bold mt-2"
                : "text-red-400 text-4xl font-bold mt-2"
            }
          >
            {trade.return_pct || 0}%
          </p>
        </div>

        <div className="bg-gray-900 p-6 rounded-2xl">
          <p className="text-gray-400">RR</p>

          <p className="text-blue-400 text-4xl font-bold mt-2">
            {trade.rr || 0}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-gray-900 p-6 rounded-2xl">
          <p className="text-gray-400">Strategie</p>

          <p className="text-xl mt-2">
            {trade.strategy || "-"}
          </p>
        </div>

        <div className="bg-gray-900 p-6 rounded-2xl">
          <p className="text-gray-400">Setup Score</p>

          <p className="text-3xl font-bold mt-2">
            {trade.setup_score || 0}/10
          </p>
        </div>
      </div>

      <div className="bg-gray-900 p-6 rounded-2xl">
        <p className="text-gray-400 mb-3">
          Notities
        </p>

        <p>
          {trade.notes || "Geen notities"}
        </p>
      </div>
    </main>
  );
}