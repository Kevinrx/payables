/**
 * Generates a handful of realistic sample invoice PDFs in /samples/
 * so reviewers have something to upload when testing the OCR flow.
 *
 * Run with: npm run samples
 */
import PDFDocument from "pdfkit";
import { createWriteStream, mkdirSync } from "node:fs";
import { resolve } from "node:path";

type LineItem = { description: string; quantity: number; unitPrice: number };
type Invoice = {
  filename: string;
  vendorName: string;
  vendorAddress: string;
  vendorEmail: string;
  customerName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  lineItems: LineItem[];
  taxRate: number;
  notes?: string;
};

const SAMPLES: Invoice[] = [
  {
    filename: "01-acme-cloud.pdf",
    vendorName: "Acme Cloud Services, Inc.",
    vendorAddress: "1855 Folsom St, San Francisco, CA 94103",
    vendorEmail: "billing@acmecloud.com",
    customerName: "Demo Company",
    invoiceNumber: "ACM-2026-0501",
    invoiceDate: "2026-05-01",
    dueDate: "2026-05-31",
    lineItems: [
      { description: "Compute hours – production cluster", quantity: 720, unitPrice: 1.45 },
      { description: "Egress bandwidth (GB)", quantity: 1850, unitPrice: 0.09 },
      { description: "Object storage (TB-month)", quantity: 4, unitPrice: 23.0 },
    ],
    taxRate: 0.0875,
    notes: "Net 30. Wire instructions on file.",
  },
  {
    filename: "02-northwind-logistics.pdf",
    vendorName: "Northwind Logistics LLC",
    vendorAddress: "120 Pier 9, Brooklyn, NY 11201",
    vendorEmail: "ap@northwind.co",
    customerName: "Demo Company Inc.",
    invoiceNumber: "NW-99841",
    invoiceDate: "2026-05-07",
    dueDate: "2026-06-06",
    lineItems: [
      { description: "Same-day courier — April", quantity: 14, unitPrice: 48.0 },
      { description: "Overnight freight — pallet", quantity: 2, unitPrice: 285.0 },
      { description: "Fuel surcharge", quantity: 1, unitPrice: 32.5 },
    ],
    taxRate: 0.04,
  },
  {
    filename: "03-globex-supplies.pdf",
    vendorName: "Globex Office Supplies",
    vendorAddress: "455 Market St #200, Austin, TX 78701",
    vendorEmail: "invoices@globex.com",
    customerName: "Demo Company",
    invoiceNumber: "GLX-771234",
    invoiceDate: "2026-04-18",
    dueDate: "2026-05-18",
    lineItems: [
      { description: "Standing desk – Model E2", quantity: 4, unitPrice: 499.0 },
      { description: "Monitor arm – dual", quantity: 8, unitPrice: 125.0 },
      { description: "Notebooks (case of 24)", quantity: 3, unitPrice: 68.0 },
      { description: "Premium pens (box of 12)", quantity: 6, unitPrice: 24.0 },
    ],
    taxRate: 0.0825,
    notes: "PO #4421",
  },
];

function generate(invoice: Invoice, outDir: string) {
  return new Promise<void>((resolveDone, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 50 });
    const path = resolve(outDir, invoice.filename);
    const stream = createWriteStream(path);
    doc.pipe(stream);

    // Header bar
    doc.fillColor("#0c0a09").fontSize(22).font("Helvetica-Bold").text("INVOICE", { align: "right" });
    doc.moveDown(0.4);
    doc
      .fillColor("#57534e")
      .fontSize(10)
      .font("Helvetica")
      .text(`#${invoice.invoiceNumber}`, { align: "right" });

    // Vendor block
    doc.moveDown(2);
    const startY = doc.y;
    doc.fillColor("#0c0a09").fontSize(13).font("Helvetica-Bold").text(invoice.vendorName);
    doc.fontSize(9).font("Helvetica").fillColor("#57534e");
    doc.text(invoice.vendorAddress);
    doc.text(invoice.vendorEmail);

    // Bill-to block (right column)
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#57534e").text("BILL TO", 350, startY);
    doc.font("Helvetica").fontSize(11).fillColor("#0c0a09").text(invoice.customerName, 350, doc.y + 2);

    // Dates block
    doc.moveDown(2);
    const datesY = Math.max(doc.y, startY + 80);
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#57534e").text("INVOICE DATE", 50, datesY);
    doc.font("Helvetica").fontSize(11).fillColor("#0c0a09").text(invoice.invoiceDate, 50, datesY + 12);
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#57534e").text("DUE DATE", 200, datesY);
    doc.font("Helvetica").fontSize(11).fillColor("#0c0a09").text(invoice.dueDate, 200, datesY + 12);

    // Line items table
    const tableTop = datesY + 60;
    doc.moveTo(50, tableTop - 10).lineTo(560, tableTop - 10).strokeColor("#d6d3d1").stroke();
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#57534e");
    doc.text("DESCRIPTION", 50, tableTop);
    doc.text("QTY", 380, tableTop, { width: 40, align: "right" });
    doc.text("UNIT", 430, tableTop, { width: 60, align: "right" });
    doc.text("AMOUNT", 500, tableTop, { width: 60, align: "right" });
    doc.moveTo(50, tableTop + 14).lineTo(560, tableTop + 14).strokeColor("#d6d3d1").stroke();

    let y = tableTop + 22;
    let subtotal = 0;
    for (const li of invoice.lineItems) {
      const amount = li.quantity * li.unitPrice;
      subtotal += amount;
      doc.font("Helvetica").fontSize(10).fillColor("#0c0a09");
      doc.text(li.description, 50, y, { width: 320 });
      doc.text(li.quantity.toString(), 380, y, { width: 40, align: "right" });
      doc.text(`$${li.unitPrice.toFixed(2)}`, 430, y, { width: 60, align: "right" });
      doc.text(`$${amount.toFixed(2)}`, 500, y, { width: 60, align: "right" });
      y += 22;
    }

    // Totals
    const tax = subtotal * invoice.taxRate;
    const total = subtotal + tax;
    y += 10;
    doc.moveTo(380, y).lineTo(560, y).strokeColor("#d6d3d1").stroke();
    y += 8;
    doc.font("Helvetica").fontSize(10).fillColor("#57534e").text("Subtotal", 380, y);
    doc.font("Helvetica").fontSize(10).fillColor("#0c0a09").text(`$${subtotal.toFixed(2)}`, 500, y, { width: 60, align: "right" });
    y += 16;
    doc.fillColor("#57534e").text(`Tax (${(invoice.taxRate * 100).toFixed(2)}%)`, 380, y);
    doc.fillColor("#0c0a09").text(`$${tax.toFixed(2)}`, 500, y, { width: 60, align: "right" });
    y += 16;
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#0c0a09").text("Total", 380, y);
    doc.text(`$${total.toFixed(2)}`, 500, y, { width: 60, align: "right" });

    if (invoice.notes) {
      y += 50;
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#57534e").text("NOTES", 50, y);
      doc.font("Helvetica").fontSize(10).fillColor("#0c0a09").text(invoice.notes, 50, y + 12, { width: 460 });
    }

    doc.end();
    stream.on("finish", () => resolveDone());
    stream.on("error", reject);
  });
}

// ─── Edge-case "stress test" samples ────────────────────────────────
//
// These don't look like the canonical 3 samples. They're deliberately
// sparse / receipt-shaped / non-invoice-shaped so a reviewer can
// reproduce the "partial extraction" path (Claude legitimately can't
// recover fields that aren't on the page) and confirm the new
// info-toast UX + lenient schema fallback.

type PartialSpec = {
  filename: string;
  kind: "receipt" | "scrap" | "blank";
  vendorName?: string;
  invoiceDate?: string;
  total?: number;
  lineItems?: { description: string; amount: number }[];
};

const PARTIAL_SAMPLES: PartialSpec[] = [
  {
    filename: "test-partial-receipt.pdf",
    kind: "receipt",
    vendorName: "Bluestone Coffee Bar",
    invoiceDate: "2026-05-07",
    lineItems: [
      { description: "Drip coffee, large", amount: 4.5 },
      { description: "Almond croissant",   amount: 5.25 },
      { description: "Avocado toast",      amount: 12.0 },
    ],
    total: 21.75,
  },
  {
    filename: "test-partial-scrap.pdf",
    kind: "scrap",
    vendorName: "Marlow & Co.",
    total: 850,
  },
  {
    filename: "test-not-an-invoice.pdf",
    kind: "blank",
  },
];

function generatePartial(spec: PartialSpec, outDir: string) {
  return new Promise<void>((resolveDone, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 60 });
    const path = resolve(outDir, spec.filename);
    const stream = createWriteStream(path);
    doc.pipe(stream);

    if (spec.kind === "receipt") {
      // Receipt: vendor + date + a few lines + total. No invoice #, no
      // due date, no tax line. Claude will return nulls for those.
      doc.fillColor("#0c0a09").fontSize(18).font("Helvetica-Bold").text(spec.vendorName!, { align: "center" });
      doc.moveDown(0.3);
      doc.font("Helvetica").fontSize(10).fillColor("#57534e")
        .text("Thank you for your visit", { align: "center" });
      doc.moveDown(0.3);
      doc.text(spec.invoiceDate!, { align: "center" });
      doc.moveDown(1.5);

      let y = doc.y;
      for (const li of spec.lineItems!) {
        doc.font("Helvetica").fontSize(11).fillColor("#0c0a09");
        doc.text(li.description, 80, y, { width: 320 });
        doc.text(`$${li.amount.toFixed(2)}`, 400, y, { width: 100, align: "right" });
        y += 20;
      }
      y += 14;
      doc.moveTo(80, y).lineTo(500, y).strokeColor("#d6d3d1").stroke();
      y += 12;
      doc.font("Helvetica-Bold").fontSize(12).fillColor("#0c0a09");
      doc.text("TOTAL", 80, y);
      doc.text(`$${spec.total!.toFixed(2)}`, 400, y, { width: 100, align: "right" });
    } else if (spec.kind === "scrap") {
      // Scribble-style note. Just a vendor name and an amount owed.
      // No dates, no invoice #, no line items.
      doc.fillColor("#0c0a09").fontSize(14).font("Helvetica").text("Note to self:", 80, 100);
      doc.moveDown(1);
      doc.fontSize(16).font("Helvetica-Bold").text(`Owe ${spec.vendorName}: $${spec.total!.toFixed(0)}`);
      doc.moveDown(1);
      doc.fontSize(11).font("Helvetica").fillColor("#57534e")
        .text("(pay before end of month)");
    } else {
      // "Not an invoice": a blank page with a single irrelevant
      // paragraph. The extraction should return all-nulls and the
      // user should land in an empty editor with a toast.
      doc.fillColor("#0c0a09").fontSize(14).font("Helvetica")
        .text("Quarterly engineering offsite — agenda", 60, 80);
      doc.moveDown(1.2);
      doc.fontSize(11).fillColor("#57534e")
        .text(
          "10:00 — kickoff & retro. 11:30 — tech-debt prioritization. " +
          "13:00 — lunch. 14:00 — architecture review. 16:00 — open mic.",
          { width: 480 }
        );
    }

    doc.end();
    stream.on("finish", () => resolveDone());
    stream.on("error", reject);
  });
}

async function main() {
  // We write each sample to two locations:
  //   - /samples/        canonical source, referenced by README + npm scripts
  //   - /public/samples/ served at /samples/<file> so the upload UI can offer
  //                      one-click "try a sample" chips
  const outDirs = [
    resolve(process.cwd(), "samples"),
    resolve(process.cwd(), "public", "samples"),
  ];
  for (const dir of outDirs) mkdirSync(dir, { recursive: true });
  for (const inv of SAMPLES) {
    for (const dir of outDirs) {
      await generate(inv, dir);
    }
    console.log(`✓ ${inv.filename}`);
  }
  for (const spec of PARTIAL_SAMPLES) {
    for (const dir of outDirs) {
      await generatePartial(spec, dir);
    }
    console.log(`✓ ${spec.filename}  (edge case: ${spec.kind})`);
  }
  console.log(
    `\nWrote ${SAMPLES.length + PARTIAL_SAMPLES.length} samples to ${outDirs.join(", ")}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
