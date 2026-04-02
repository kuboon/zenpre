import {
  type ExportedKeyPair,
  exportKeyPair,
  generateKeyPair,
  importKeyPair,
} from "./subtle.ts";
import { configRepo } from "#/server/config.ts";

const keyRepo = configRepo.entry<ExportedKeyPair>("signKey");

async function getSignKey(): Promise<ExportedKeyPair> {
  let signKey = await keyRepo.get();
  if (!signKey) {
    const keyPair = await generateKeyPair();
    signKey = await exportKeyPair(keyPair);
    await keyRepo.update(() => signKey);
  }
  return signKey;
}

export const keyPair = await importKeyPair(await getSignKey());
