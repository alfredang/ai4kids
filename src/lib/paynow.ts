/**
 * Singapore PayNow dynamic QR generator (EMVCo SGQR payload).
 * Builds the TLV string for a UEN-addressed PayNow payment with a fixed amount
 * and a bill reference, then renders it to a PNG data-URI via the `qrcode` lib.
 *
 * Spec refs: EMVCo Merchant-Presented QR + the PayNow scheme (AID SG.PAYNOW).
 */
import QRCode from "qrcode";

/** id + length(2-digit, zero-padded) + value */
function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

/** CRC-16/CCITT-FALSE over the payload (incl. the "6304" CRC tag header). */
function crc16(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export type PayNowOptions = {
  uen: string; // merchant UEN (proxy type "2")
  amountCents: number;
  reference: string; // bill / booking reference
  merchantName: string;
  editable?: boolean; // can the payer change the amount? default false
  expiry?: string; // YYYYMMDD optional
};

export function buildPayNowPayload(opts: PayNowOptions): string {
  const amount = (opts.amountCents / 100).toFixed(2);
  const merchantName = opts.merchantName.slice(0, 25);
  const reference = opts.reference.slice(0, 25);

  // Tag 26 — PayNow merchant account information
  const merchantAccount = tlv(
    "26",
    tlv("00", "SG.PAYNOW") +
      tlv("01", "2") + // proxy type: 2 = UEN
      tlv("02", opts.uen) +
      tlv("03", opts.editable ? "1" : "0") +
      (opts.expiry ? tlv("04", opts.expiry) : ""),
  );

  const additionalData = tlv("62", tlv("01", reference));

  const payloadNoCrc =
    tlv("00", "01") + // payload format indicator
    tlv("01", "12") + // dynamic QR
    merchantAccount +
    tlv("52", "0000") + // merchant category code
    tlv("53", "702") + // currency SGD
    tlv("54", amount) +
    tlv("58", "SG") + // country
    tlv("59", merchantName) +
    tlv("60", "Singapore") + // city
    additionalData +
    "6304"; // CRC tag + length, value computed over everything up to here

  return payloadNoCrc + crc16(payloadNoCrc);
}

/** Returns a PNG data-URI for the PayNow QR (embeddable in HTML emails). */
export async function generatePayNowQrDataUrl(opts: PayNowOptions): Promise<string> {
  const payload = buildPayNowPayload(opts);
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 320,
    color: { dark: "#1f2937", light: "#ffffff" },
  });
}

