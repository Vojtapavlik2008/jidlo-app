export function printReceipt(order: any, items: any[]) {
  const w = window.open("", "_blank", "width=400,height=800");
  if (!w) return;

  const date = new Date(order.created_at).toLocaleString("cs-CZ");

  const itemsHtml = items
    .map(
      (it) => `
      <div style="display:flex; justify-content:space-between; font-size:14px;">
        <div>${it.qty} x ${it.name}</div>
        <div>${it.line_total} Kč</div>
      </div>
    `
    )
    .join("");

  w.document.write(`
    <html>
      <head>
        <title>Účtenka</title>
        <style>
          body {
            font-family: monospace;
            width: 300px;
            margin: 0 auto;
            padding: 10px;
          }
          .center { text-align: center; }
          .big { font-size: 22px; font-weight: bold; }
          .line { border-top: 1px dashed #000; margin: 8px 0; }
        </style>
      </head>
      <body>
        <div class="center big">Jiřka</div>
        <div class="center">Kunštátská 1141 - 2. patro</div>
        <div class="center">Poděbrady</div>
        <div class="center">Tel: 736228520</div>

        <div class="line"></div>

        <div>Objednávka č.: ${order.id}</div>
        <div>Datum: ${date}</div>

        <div class="line"></div>

        ${itemsHtml}

        <div class="line"></div>

        <div style="display:flex; justify-content:space-between; font-size:18px; font-weight:bold;">
          <div>Celkem:</div>
          <div>${order.total} Kč</div>
        </div>

        ${
          order.payment_method === "credit"
            ? `
            <div class="line"></div>
            <div>Platba z kreditu</div>
          `
            : ""
        }

        <script>
          window.onload = function() {
            window.print();
            window.close();
          }
        </script>
      </body>
    </html>
  `);

  w.document.close();
}