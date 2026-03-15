import CartClient from "./CartClient";

export default function KosikPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto w-full max-w-6xl px-6 py-8">
        <CartClient />
      </div>
    </div>
  );
}