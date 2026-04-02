import { keyPair } from "./keyPair.ts";
import { signBuffer, verifyBuffer } from "./subtle.ts";
import { decodeBase64Url, encodeBase64Url } from "@std/encoding";

const { publicKey, privateKey } = keyPair;

export async function sign(data: string): Promise<string> {
  const dataBuf = new TextEncoder().encode(data);
  const signature = await signBuffer(privateKey, dataBuf);
  return encodeBase64Url(signature);
}
export async function verify(
  data: string,
  sign: string,
): Promise<boolean> {
  const dataBuf = new TextEncoder().encode(data);
  const sigBuf = decodeBase64Url(sign);
  return await verifyBuffer(publicKey, sigBuf, dataBuf);
}
