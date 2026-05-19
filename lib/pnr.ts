const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I

/**
 * Client-side PNR generator. Authoritative PNR generation lives in the
 * `reserve_seat` RPC (with a uniqueness retry loop); this is used for
 * display fallbacks and tests.
 */
export function generatePnr(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}
