"use client";

import { supabase } from "@/lib/supabase";
import { useParams, useRouter } from "next/navigation";

export default function DeleteTradePage() {
  const params = useParams();
  const router = useRouter();

  async function handleDelete() {
    const confirmed = window.confirm(
      "Weet je zeker dat je deze trade wilt verwijderen?"
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("trades")
      .delete()
      .eq("id", params.id);

    if (error) {
      console.error(error);
      alert("Fout bij verwijderen");
      return;
    }

    alert("Trade verwijderd");

    router.push("/");
  }

  return (
    <main className="min-h-screen bg-black text-white p-8 max-w-3xl mx-auto">
      <h1 className="text-5xl font-bold mb-8">
        Delete Trade
      </h1>

      <div className="bg-gray-900 p-8 rounded-2xl">

        <p className="text-xl mb-6">
          Weet je zeker dat je deze trade wilt verwijderen?
        </p>

        <div className="flex gap-4">

          <button
            onClick={handleDelete}
            className="bg-red-600 hover:bg-red-500 px-8 py-4 rounded-xl font-semibold"
          >
            Ja, verwijder trade
          </button>

          <button
            onClick={() => router.back()}
            className="bg-gray-700 hover:bg-gray-600 px-8 py-4 rounded-xl font-semibold"
          >
            Annuleren
          </button>

        </div>

      </div>
    </main>
  );
}