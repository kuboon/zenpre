const ECDSA_ALGORITHM: EcdsaParams = {
  name: "ECDSA",
  hash: "SHA-256",
};

const ECDSA_KEY_ALGORITHM: EcKeyGenParams = {
  name: "ECDSA",
  namedCurve: "P-256",
};

function toArrayBuffer(buffer: BufferSource): ArrayBuffer {
  if (buffer instanceof ArrayBuffer) {
    return buffer;
  }
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  );
}

export type ExportedKeyPair = {
  publicKey: ArrayBuffer;
  privateKey: ArrayBuffer;
};

export type ImportedKeyPair = {
  publicKey: BufferSource;
  privateKey: BufferSource;
};

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    ECDSA_KEY_ALGORITHM,
    true,
    ["sign", "verify"],
  ) as CryptoKeyPair;
}

export async function exportKeyPair(
  keyPair: CryptoKeyPair,
): Promise<ExportedKeyPair> {
  const [publicKey, privateKey] = await Promise.all([
    crypto.subtle.exportKey("spki", keyPair.publicKey),
    crypto.subtle.exportKey("pkcs8", keyPair.privateKey),
  ]);

  return {
    publicKey,
    privateKey,
  };
}

export async function importKeyPair(
  keyPair: ImportedKeyPair,
): Promise<CryptoKeyPair> {
  const [publicKey, privateKey] = await Promise.all([
    crypto.subtle.importKey(
      "spki",
      toArrayBuffer(keyPair.publicKey),
      ECDSA_KEY_ALGORITHM,
      true,
      ["verify"],
    ),
    crypto.subtle.importKey(
      "pkcs8",
      toArrayBuffer(keyPair.privateKey),
      ECDSA_KEY_ALGORITHM,
      true,
      ["sign"],
    ),
  ]);

  return {
    publicKey,
    privateKey,
  };
}

export async function signBuffer(
  privateKey: CryptoKey,
  data: BufferSource,
): Promise<ArrayBuffer> {
  return await crypto.subtle.sign(ECDSA_ALGORITHM, privateKey, data);
}

export async function verifyBuffer(
  publicKey: CryptoKey,
  signature: BufferSource,
  data: BufferSource,
): Promise<boolean> {
  return await crypto.subtle.verify(
    ECDSA_ALGORITHM,
    publicKey,
    signature,
    data,
  );
}
