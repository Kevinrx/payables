import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

// ─── Output schema (validated with Zod after the model returns) ─────

export const ExtractedInvoiceSchema = z.object({
  vendor_name: z.string().min(1).nullable(),
  invoice_number: z.string().nullable(),
  invoice_date: z.string().nullable(), // YYYY-MM-DD
  due_date: z.string().nullable(),
  currency: z.string().default("USD"),
  subtotal: z.number().nullable(),
  tax: z.number().nullable(),
  total: z.number().nullable(),
  line_items: z
    .array(
      z.object({
        description: z.string().min(1),
        quantity: z.number().nullable(),
        unit_price: z.number().nullable(),
        amount: z.number(),
      })
    )
    .default([]),
  notes: z.string().nullable().default(null),
});

export type ExtractedInvoice = z.infer<typeof ExtractedInvoiceSchema>;

// ─── Tool schema (what we send to Claude) ───────────────────────────

const TOOL_INPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    vendor_name: {
      type: ["string", "null"],
      description:
        "The name of the company or person who issued the invoice (the seller). Not the buyer/customer.",
    },
    invoice_number: {
      type: ["string", "null"],
      description: "Invoice number, reference number, or document ID printed on the invoice.",
    },
    invoice_date: {
      type: ["string", "null"],
      description: "Date the invoice was issued, ISO 8601 format YYYY-MM-DD.",
    },
    due_date: {
      type: ["string", "null"],
      description: "Date payment is due, ISO 8601 format YYYY-MM-DD.",
    },
    currency: {
      type: "string",
      description:
        "ISO 4217 currency code (USD, EUR, GBP, etc). Default to USD if no currency symbol is shown.",
    },
    subtotal: {
      type: ["number", "null"],
      description: "Subtotal before tax, as a decimal number in major units (e.g. 1234.56).",
    },
    tax: {
      type: ["number", "null"],
      description: "Tax amount, as a decimal number in major units.",
    },
    total: {
      type: ["number", "null"],
      description: "Final total to be paid, as a decimal number in major units.",
    },
    line_items: {
      type: "array",
      description:
        "Each individual line on the invoice. Skip subtotal/tax/total summary rows.",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          quantity: { type: ["number", "null"] },
          unit_price: { type: ["number", "null"] },
          amount: { type: "number" },
        },
        required: ["description", "amount"],
      },
    },
    notes: {
      type: ["string", "null"],
      description:
        "Any short note from the invoice memo/notes/PO field that would help an AP clerk. Null if none.",
    },
  },
  required: ["vendor_name", "currency", "total", "line_items"],
} as const;

const SYSTEM_PROMPT = `You are an expert AP (accounts payable) data extraction system. Given an invoice (image or PDF), extract its key fields with high precision.

Critical rules:
- Identify the SELLER (vendor) issuing the invoice — not the BUYER (the customer being billed).
- All monetary amounts are in major units (e.g. 1234.56 not 123456).
- Dates must be ISO 8601 (YYYY-MM-DD). If the year isn't shown, infer from context (current year unless otherwise indicated).
- Skip header/summary rows in line_items — only extract actual itemized lines.
- If a field is genuinely not present on the document, use null. Do not invent.
- If the document is clearly NOT an invoice (e.g. a photo of an unrelated object), return null for vendor_name, total, and an empty line_items array.

Return your extraction by calling the save_invoice tool exactly once.`;

// ─── Public API ─────────────────────────────────────────────────────

export type ExtractInput = {
  buffer: Buffer;
  mime: string;
};

export async function extractInvoice(input: ExtractInput): Promise<ExtractedInvoice> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const base64 = input.buffer.toString("base64");
  const isPdf = input.mime === "application/pdf";
  const isImage = input.mime.startsWith("image/");

  if (!isPdf && !isImage) {
    throw new Error(`Unsupported mime type for extraction: ${input.mime}`);
  }

  const documentBlock = isPdf
    ? {
        type: "document" as const,
        source: {
          type: "base64" as const,
          media_type: "application/pdf" as const,
          data: base64,
        },
      }
    : {
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: input.mime as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
          data: base64,
        },
      };

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    tools: [
      {
        name: "save_invoice",
        description: "Save the extracted invoice fields.",
        input_schema: TOOL_INPUT_SCHEMA as unknown as Anthropic.Messages.Tool["input_schema"],
      },
    ],
    tool_choice: { type: "tool", name: "save_invoice" },
    messages: [
      {
        role: "user",
        content: [
          documentBlock,
          {
            type: "text",
            text: "Extract this invoice using the save_invoice tool.",
          },
        ],
      },
    ],
  });

  // Find the tool_use block.
  const toolUse = response.content.find(
    (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
  );
  if (!toolUse) {
    throw new Error("Model did not return a tool_use block");
  }

  const parsed = ExtractedInvoiceSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    throw new Error(
      `Model output failed schema validation: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`
    );
  }
  return parsed.data;
}
