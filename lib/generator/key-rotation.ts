import { StoredApiKey, getStoredApiKeys, saveStoredApiKey } from './db';
import { toast } from 'sonner';

export class KeyRotationManager {
  private keys: StoredApiKey[] = [];
  private loaded = false;

  async loadKeys(): Promise<StoredApiKey[]> {
    this.keys = await getStoredApiKeys();
    this.loaded = true;
    this.cleanRestingKeys();
    return this.keys;
  }

  private cleanRestingKeys(): void {
    const now = Date.now();
    for (const key of this.keys) {
      if (key.restingUntil && key.restingUntil <= now) {
        key.restingUntil = undefined;
        saveStoredApiKey(key);
      }
    }
  }

  // Pick an active, non-invalid, non-resting key
  async getNextKey(): Promise<{ apiKey?: string; keyId?: string } | null> {
    if (!this.loaded) {
      await this.loadKeys();
    }
    this.cleanRestingKeys();

    const activeKeys = this.keys.filter((k) => k.isActive && !k.isInvalid);

    // If user has no custom keys configured at all, fallback to server process.env
    if (activeKeys.length === 0) {
      return { apiKey: undefined, keyId: undefined };
    }

    const now = Date.now();
    const availableKeys = activeKeys.filter((k) => !k.restingUntil || k.restingUntil <= now);

    if (availableKeys.length > 0) {
      // Pick random available key for load balancing
      const chosen = availableKeys[Math.floor(Math.random() * availableKeys.length)];
      return { apiKey: chosen.key, keyId: chosen.id };
    }

    // All custom keys are currently resting
    // Calculate the shortest remaining wait time
    const restingTimes = activeKeys
      .map((k) => (k.restingUntil ? k.restingUntil - now : 60000))
      .filter((t) => t > 0);

    const minWait = restingTimes.length > 0 ? Math.min(...restingTimes) : 40000;
    const waitSeconds = Math.ceil(minWait / 1000);

    toast.info(`All API keys are cooling down, resuming in ${waitSeconds}s`);

    // Wait for the key cooldown
    await new Promise((resolve) => setTimeout(resolve, Math.min(minWait, 60000)));

    this.cleanRestingKeys();
    const recovered = activeKeys.filter((k) => !k.restingUntil || k.restingUntil <= Date.now());
    if (recovered.length > 0) {
      const chosen = recovered[Math.floor(Math.random() * recovered.length)];
      return { apiKey: chosen.key, keyId: chosen.id };
    }

    return { apiKey: undefined, keyId: undefined };
  }

  async markKeyRateLimited(keyId?: string, cooldownMs = 60000): Promise<void> {
    if (!keyId) return;
    const target = this.keys.find((k) => k.id === keyId);
    if (target) {
      target.restingUntil = Date.now() + cooldownMs;
      await saveStoredApiKey(target);
    }
  }

  async markKeyInvalid(keyId?: string): Promise<void> {
    if (!keyId) return;
    const target = this.keys.find((k) => k.id === keyId);
    if (target) {
      target.isInvalid = true;
      target.isActive = false;
      await saveStoredApiKey(target);
      toast.error(`API key "${target.label || 'Key'}" marked invalid (authentication failed)`);
    }
  }
}

export const keyRotator = new KeyRotationManager();
