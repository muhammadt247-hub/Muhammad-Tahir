import { StoredApiKey, AiProvider, getStoredApiKeys, saveStoredApiKey } from './db';
import { toast } from 'sonner';

export interface NextKeyResult {
  apiKey?: string;
  keyId?: string;
  label?: string;
  maskedKey?: string;
  keyIndex?: number;
  isDefaultEnv?: boolean;
  allResting?: boolean;
  minWaitSeconds?: number;
  totalActive?: number;
  isSharedRateLimit?: boolean;
  provider?: AiProvider;
}

/**
 * Format a masked API key for UI display (e.g., "Key 2 (***7a8b)" or "Default Key (Server Env)")
 */
export function formatMaskedKey(key?: string, label?: string, index?: number): string {
  if (!key) {
    return 'Default Key (Server Env)';
  }
  const lastFour = key.length > 4 ? key.slice(-4) : key;
  const name = label || (index !== undefined ? `Key ${index + 1}` : 'Key');
  return `${name} (***${lastFour})`;
}

export class KeyRotationManager {
  private keys: StoredApiKey[] = [];
  private loaded = false;
  private currentIndexByProvider: Record<AiProvider, number> = { gemini: 0, grok: 0 };
  private consecutiveShared429s = 0;

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
      if (key.dailyQuotaExhaustedUntil && key.dailyQuotaExhaustedUntil <= now) {
        key.dailyQuotaExhaustedUntil = undefined;
        saveStoredApiKey(key);
      }
    }
  }

  // Pick an active, non-invalid, non-resting key sequentially via controlled round-robin
  async getNextKey(provider: AiProvider = 'gemini'): Promise<NextKeyResult> {
    if (!this.loaded) {
      await this.loadKeys();
    }
    this.cleanRestingKeys();

    const activeKeys = this.keys.filter(
      (k) => (k.provider === provider || (!k.provider && provider === 'gemini')) && k.isActive && !k.isInvalid
    );

    // If user has no custom keys configured for this provider
    if (activeKeys.length === 0) {
      if (provider === 'gemini') {
        return {
          apiKey: undefined,
          keyId: undefined,
          isDefaultEnv: true,
          maskedKey: 'Default Key (Server Env)',
          totalActive: 0,
          provider,
        };
      } else {
        return {
          apiKey: undefined,
          keyId: undefined,
          isDefaultEnv: false,
          maskedKey: 'No Grok Key Added',
          totalActive: 0,
          provider,
        };
      }
    }

    const now = Date.now();
    const availableKeys = activeKeys.filter(
      (k) =>
        (!k.restingUntil || k.restingUntil <= now) &&
        (!k.dailyQuotaExhaustedUntil || k.dailyQuotaExhaustedUntil <= now)
    );

    // If multiple keys in a row hit 429 and exhausted the shared project quota
    if (this.consecutiveShared429s >= activeKeys.length && activeKeys.length > 0) {
      const restingTimes = activeKeys
        .map((k) => (k.restingUntil && k.restingUntil > now ? k.restingUntil - now : 30000))
        .filter((t) => t > 0);
      const minWait = restingTimes.length > 0 ? Math.min(...restingTimes) : 30000;
      const minWaitSeconds = Math.max(1, Math.ceil(minWait / 1000));
      return {
        apiKey: undefined,
        keyId: undefined,
        allResting: true,
        isSharedRateLimit: true,
        minWaitSeconds,
        totalActive: activeKeys.length,
        provider,
      };
    }

    if (availableKeys.length > 0) {
      // Sequential controlled rotation: advance pointer for this provider
      const curIdx = this.currentIndexByProvider[provider] || 0;
      this.currentIndexByProvider[provider] = (curIdx + 1) % availableKeys.length;
      const chosen = availableKeys[this.currentIndexByProvider[provider]];
      chosen.lastUsedAt = now;
      saveStoredApiKey(chosen);

      const realIndex = this.keys.findIndex((k) => k.id === chosen.id);
      const displayIndex = realIndex >= 0 ? realIndex : this.currentIndexByProvider[provider];

      return {
        apiKey: chosen.key,
        keyId: chosen.id,
        label: chosen.label || `${provider === 'grok' ? 'Grok Key' : 'Key'} ${displayIndex + 1}`,
        maskedKey: formatMaskedKey(chosen.key, chosen.label, displayIndex),
        keyIndex: displayIndex + 1,
        totalActive: activeKeys.length,
        provider,
      };
    }

    // All custom keys for this provider are currently resting or daily exhausted
    const restingTimes = activeKeys
      .map((k) => {
        if (k.restingUntil && k.restingUntil > now) return k.restingUntil - now;
        if (k.dailyQuotaExhaustedUntil && k.dailyQuotaExhaustedUntil > now)
          return k.dailyQuotaExhaustedUntil - now;
        return 30000;
      })
      .filter((t) => t > 0);

    const minWait = restingTimes.length > 0 ? Math.min(...restingTimes) : 30000;
    const minWaitSeconds = Math.max(1, Math.ceil(minWait / 1000));

    return {
      apiKey: undefined,
      keyId: undefined,
      allResting: true,
      minWaitSeconds,
      totalActive: activeKeys.length,
      provider,
    };
  }

  // Waits until at least one key is ready, providing live countdown ticks
  async waitForNextAvailableKey(
    abortSignal?: AbortSignal,
    onTick?: (secondsRemaining: number, reason: string) => void,
    provider: AiProvider = 'gemini'
  ): Promise<NextKeyResult> {
    while (!abortSignal?.aborted) {
      const next = await this.getNextKey(provider);
      if (!next.allResting) {
        this.consecutiveShared429s = 0;
        return next;
      }

      let secondsRemaining = next.minWaitSeconds || 30;
      // Cap individual tick block to 120s max for responsiveness
      secondsRemaining = Math.min(secondsRemaining, 120);

      const providerLabel = provider === 'grok' ? 'Grok' : 'Gemini';

      while (secondsRemaining > 0 && !abortSignal?.aborted) {
        const reason = next.isSharedRateLimit
          ? `Shared ${providerLabel} quota cooldown: Pausing all ${next.totalActive || 'configured'} keys. Resuming automatically in ${secondsRemaining}s...`
          : `${providerLabel} rate limit cooldown: All ${next.totalActive || 'configured'} keys are resting. Resuming automatically in ${secondsRemaining}s...`;

        onTick?.(secondsRemaining, reason);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        secondsRemaining--;
      }

      if (abortSignal?.aborted) break;
      // Re-check after waiting
      await this.loadKeys();
    }

    return { apiKey: undefined, keyId: undefined, provider };
  }

  // Mark key as rate limited with exponential backoff & jitter
  async markKeyRateLimited(keyId?: string, retryAfterSeconds = 30): Promise<number> {
    this.consecutiveShared429s++;

    if (!keyId) {
      // Default env key rate-limited
      return Math.ceil(retryAfterSeconds);
    }

    const target = this.keys.find((k) => k.id === keyId);
    const activeKeys = this.keys.filter((k) => k.isActive && !k.isInvalid);

    // If multiple keys have failed in a row, detect shared project quota
    const isSharedQuota = this.consecutiveShared429s >= activeKeys.length && activeKeys.length > 1;

    if (target) {
      target.consecutiveErrors = (target.consecutiveErrors || 0) + 1;
      const backoffMultiplier = Math.min(3, Math.pow(1.5, target.consecutiveErrors - 1));
      const jitterMs = Math.floor(Math.random() * 2000);
      const totalCooldownMs = Math.round(retryAfterSeconds * 1000 * backoffMultiplier) + jitterMs;

      target.restingUntil = Date.now() + totalCooldownMs;
      await saveStoredApiKey(target);

      const waitSec = Math.ceil(totalCooldownMs / 1000);

      if (isSharedQuota) {
        // Shared project rate limit: pause all active keys so we don't thrash and waste requests
        const now = Date.now();
        for (const k of activeKeys) {
          k.restingUntil = Math.max(k.restingUntil || 0, now + totalCooldownMs);
          await saveStoredApiKey(k);
        }
        toast.warning(
          `Shared project quota reached across all ${activeKeys.length} keys. Pausing for ${waitSec}s to allow quota replenishment...`
        );
      } else {
        toast.warning(
          `API key "${target.label || 'Key'}" hit rate limit. Cooling down for ${waitSec}s, switching key...`
        );
      }

      return waitSec;
    }

    return Math.ceil(retryAfterSeconds);
  }

  // Mark key as reached daily quota
  async markKeyDailyExhausted(keyId?: string): Promise<void> {
    if (!keyId) return;
    const target = this.keys.find((k) => k.id === keyId);
    if (target) {
      const now = new Date();
      // Set to midnight UTC tomorrow
      const tomorrowMidnight = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 5, 0)
      ).getTime();
      target.dailyQuotaExhaustedUntil = tomorrowMidnight;
      await saveStoredApiKey(target);
      toast.error(
        `API key "${target.label || 'Key'}" reached daily quota. Key paused until tomorrow midnight UTC.`
      );
    }
  }

  // Mark key as permanently invalid (auth failure 401/403)
  async markKeyInvalid(keyId?: string): Promise<void> {
    if (!keyId) return;
    const target = this.keys.find((k) => k.id === keyId);
    if (target) {
      target.isInvalid = true;
      target.isActive = false;
      await saveStoredApiKey(target);
      toast.error(
        `API key "${target.label || 'Key'}" marked invalid (Authentication failed). Key will not be retried.`
      );
    }
  }

  // Reset consecutive errors on successful request
  async recordKeySuccess(keyId?: string): Promise<void> {
    this.consecutiveShared429s = 0;
    if (!keyId) return;
    const target = this.keys.find((k) => k.id === keyId);
    if (target && target.consecutiveErrors) {
      target.consecutiveErrors = 0;
      await saveStoredApiKey(target);
    }
  }
}

export const keyRotator = new KeyRotationManager();
