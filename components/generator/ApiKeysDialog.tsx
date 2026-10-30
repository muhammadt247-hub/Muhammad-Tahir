'use client';

import React, { useState, useEffect } from 'react';
import {
  Key,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Clock,
  Timer,
  Sparkles,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  StoredApiKey,
  AiProvider,
  GeneratorSavedSettings,
  getStoredApiKeys,
  saveStoredApiKey,
  deleteStoredApiKey,
} from '@/lib/generator/db';
import { AI_CONFIG } from '@/config/ai';
import { GROK_MODELS, DEFAULT_GROK_MODEL } from '@/config/models';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ApiKeysDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: GeneratorSavedSettings;
  onUpdateSettings: (settings: Partial<GeneratorSavedSettings>) => void;
  onKeysChanged?: () => void;
}

const PRESET_DELAYS = [5, 6, 10, 15];

export function ApiKeysDialog({
  open,
  onOpenChange,
  settings,
  onUpdateSettings,
  onKeysChanged,
}: ApiKeysDialogProps) {
  const [activeProvider, setActiveProvider] = useState<AiProvider>(settings.aiProvider || 'gemini');
  const [keys, setKeys] = useState<StoredApiKey[]>([]);
  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [customDelayInput, setCustomDelayInput] = useState('');

  // Keep activeProvider in sync with settings prop changes
  const [prevProvider, setPrevProvider] = useState(settings.aiProvider);
  if (settings.aiProvider && settings.aiProvider !== prevProvider) {
    setPrevProvider(settings.aiProvider);
    setActiveProvider(settings.aiProvider);
  }

  // Periodically refresh countdown for resting keys
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadKeys = async () => {
    setIsLoading(true);
    const stored = await getStoredApiKeys();
    setKeys(stored);
    setIsLoading(false);
  };

  useEffect(() => {
    if (open) {
      queueMicrotask(() => {
        loadKeys();
      });
    }
  }, [open]);

  const handleProviderSwitch = (prov: AiProvider) => {
    setActiveProvider(prov);
    onUpdateSettings({ aiProvider: prov });
    setNewKey('');
    setNewLabel('');
  };

  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = newKey.trim();
    if (!cleanKey) {
      toast.error('Please enter an API key');
      return;
    }

    if (activeProvider === 'grok') {
      if (!cleanKey.startsWith('gsk_') || cleanKey.length < 20) {
        toast.error("Groq API key must start with 'gsk_' and be at least 20 characters long.");
        return;
      }
    } else {
      if (!cleanKey.startsWith('AIzaSy')) {
        toast.warning('Gemini API keys typically start with "AIzaSy". Double-check if this key fails.');
      }
    }

    if (keys.some((k) => k.key === cleanKey)) {
      toast.error('This API key is already added');
      return;
    }

    const providerKeysCount = keys.filter(
      (k) => (activeProvider === 'gemini' ? (k.provider === 'gemini' || !k.provider) : k.provider === 'grok')
    ).length;

    const keyItem: StoredApiKey = {
      id: `key_${activeProvider}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      provider: activeProvider,
      key: cleanKey,
      label: newLabel.trim() || `${activeProvider === 'grok' ? 'Groq' : 'Gemini'} Key ${providerKeysCount + 1}`,
      isActive: true,
      addedAt: Date.now(),
    };

    try {
      await saveStoredApiKey(keyItem);
      setNewKey('');
      setNewLabel('');
      await loadKeys();
      onKeysChanged?.();
      toast.success(`${activeProvider === 'grok' ? 'Groq' : 'Gemini'} API key added successfully`);
    } catch {
      toast.error('Failed to save API key');
    }
  };

  const handleToggleKey = async (keyItem: StoredApiKey) => {
    const updated = { ...keyItem, isActive: !keyItem.isActive };
    await saveStoredApiKey(updated);
    await loadKeys();
    onKeysChanged?.();
  };

  const handleDeleteKey = async (id: string) => {
    await deleteStoredApiKey(id);
    await loadKeys();
    onKeysChanged?.();
    toast.success('API key removed');
  };

  const maskKey = (k: string) => {
    if (k.length <= 8) return '••••••••';
    return `${k.slice(0, 6)}...${k.slice(-4)}`;
  };

  const handleDelayPreset = (sec: number) => {
    setCustomDelayInput('');
    onUpdateSettings({ interImageDelaySeconds: sec });
  };

  const handleCustomDelayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomDelayInput(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      onUpdateSettings({ interImageDelaySeconds: parsed });
    }
  };

  const currentDelay = settings.interImageDelaySeconds ?? 10;

  // Filter keys for active provider
  const currentProviderKeys = keys.filter((k) =>
    activeProvider === 'gemini' ? (k.provider === 'gemini' || !k.provider) : k.provider === 'grok'
  );

  const geminiCount = keys.filter((k) => k.provider === 'gemini' || !k.provider).length;
  const grokCount = keys.filter((k) => k.provider === 'grok').length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Key className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">AI Provider &amp; API Keys</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Keys remain private in your browser (IndexedDB) and rotate sequentially with smart cooldowns.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* 1. Provider Switch: Gemini | Grok */}
          <div className="p-1 rounded-xl bg-accent/70 flex select-none">
            <button
              type="button"
              onClick={() => handleProviderSwitch('gemini')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold transition-all rounded-lg',
                activeProvider === 'gemini'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <span>Google Gemini</span>
              {geminiCount > 0 && (
                <span
                  className={cn(
                    'text-[10px] px-1.5 py-0.2 rounded-full font-bold',
                    activeProvider === 'gemini'
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {geminiCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleProviderSwitch('grok')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold transition-all rounded-lg',
                activeProvider === 'grok'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <span>Groq</span>
              {grokCount > 0 && (
                <span
                  className={cn(
                    'text-[10px] px-1.5 py-0.2 rounded-full font-bold',
                    activeProvider === 'grok'
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {grokCount}
                </span>
              )}
            </button>
          </div>

          {/* Add Key Form */}
          <form onSubmit={handleAddKey} className="p-4 rounded-xl bg-accent/40 border border-border/50 space-y-3">
            <div className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>{activeProvider === 'grok' ? 'Add Custom Groq Key' : 'Add Custom Gemini Key'}</span>
              {activeProvider === 'grok' ? (
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 font-normal"
                >
                  Get a Groq key <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 font-normal"
                >
                  Get a free key <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showKey ? 'text' : 'password'}
                    placeholder={activeProvider === 'grok' ? 'gsk_...' : 'AIzaSy...'}
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    className="pr-9 font-mono text-xs h-9 rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <Input
                  type="text"
                  placeholder="Label (optional)"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  className="w-32 text-xs h-9 rounded-xl"
                />
              </div>
              <Button type="submit" size="sm" className="w-full rounded-xl gap-1.5 h-8 text-xs font-semibold">
                <Plus className="h-3.5 w-3.5" />
                Add {activeProvider === 'grok' ? 'Groq' : 'Gemini'} API Key
              </Button>
            </div>
          </form>

          {/* Stored Keys List for Active Provider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-foreground px-1">
              <span>
                Configured {activeProvider === 'grok' ? 'Groq' : 'Gemini'} Keys ({currentProviderKeys.length})
              </span>
              {currentProviderKeys.length === 0 && activeProvider === 'gemini' && (
                <span className="text-[11px] font-normal text-muted-foreground">
                  Using default built-in AI Studio key
                </span>
              )}
            </div>

            {isLoading ? (
              <div className="py-6 text-center text-xs text-muted-foreground">Loading stored keys...</div>
            ) : currentProviderKeys.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-border/60 text-center space-y-1">
                {activeProvider === 'grok' ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      No custom Groq keys added.
                    </p>
                    <p className="text-[11px] text-muted-foreground/80">
                      Add your Groq API key from console.groq.com. You can add as many keys as you want; they will rotate automatically on rate limits.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">
                      No custom keys added. OrbinexaCSV will use the server default Gemini key.
                    </p>
                    <p className="text-[11px] text-muted-foreground/80">
                      Add your own free Google Gemini keys to bypass shared rate limits and process batches faster.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {currentProviderKeys.map((k) => {
                  const isResting = Boolean(k.restingUntil && k.restingUntil > currentTime);
                  const restingSeconds = isResting ? Math.ceil((k.restingUntil! - currentTime) / 1000) : 0;
                  const isDailyExhausted = Boolean(
                    k.dailyQuotaExhaustedUntil && k.dailyQuotaExhaustedUntil > currentTime
                  );

                  return (
                    <div
                      key={k.id}
                      className="p-3 rounded-xl border border-border/50 bg-card flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground truncate">{k.label}</span>
                          {k.isInvalid ? (
                            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">
                              <AlertCircle className="h-2.5 w-2.5" /> Invalid Key
                            </span>
                          ) : isDailyExhausted ? (
                            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
                              <Clock className="h-2.5 w-2.5" /> Daily Quota Exhausted
                            </span>
                          ) : isResting ? (
                            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-medium animate-pulse">
                              <Clock className="h-2.5 w-2.5" /> Cooling down ({restingSeconds}s)
                            </span>
                          ) : k.isActive ? (
                            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                              <ShieldCheck className="h-2.5 w-2.5" /> Ready (Sequential)
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                              Disabled
                            </span>
                          )}
                        </div>
                        <p className="font-mono text-[11px] text-muted-foreground truncate">{maskKey(k.key)}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Switch
                          checked={k.isActive}
                          onCheckedChange={() => handleToggleKey(k)}
                          className="scale-75"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteKey(k.id)}
                          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Configurable Inter-Image Delay */}
          <div className="p-4 rounded-xl bg-accent/40 border border-border/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-primary" />
                <div>
                  <Label className="text-xs font-semibold text-foreground">Sequential Delay Between Images</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Wait time after each image before processing the next image
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                {currentDelay}s
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {PRESET_DELAYS.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => handleDelayPreset(sec)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all ${
                    currentDelay === sec && !customDelayInput
                      ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                      : 'bg-card border-border/60 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {sec}s {sec === 10 && <span className="text-[9px] opacity-75">(Def)</span>}
                </button>
              ))}

              <div className="flex items-center gap-1.5 ml-auto">
                <span className="text-[11px] text-muted-foreground">Custom:</span>
                <Input
                  type="number"
                  min="0"
                  max="120"
                  placeholder="Sec"
                  value={customDelayInput}
                  onChange={handleCustomDelayChange}
                  className="w-16 h-7 text-xs rounded-lg px-2 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Model Options for Active Provider */}
          <div className="p-4 rounded-xl bg-accent/40 border border-border/50 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="text-xs font-semibold text-foreground">
                  {activeProvider === 'grok' ? 'Groq Model' : 'Gemini AI Model'}
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Model for metadata &amp; prompt generation
                </p>
              </div>
              {activeProvider === 'grok' ? (
                <Select
                  value={settings.selectedGrokModel || DEFAULT_GROK_MODEL}
                  onValueChange={(val) => onUpdateSettings({ selectedGrokModel: val })}
                >
                  <SelectTrigger className="w-52 h-8 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GROK_MODELS.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name || m.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select
                  value={settings.selectedModel || AI_CONFIG.DEFAULT_MODEL}
                  onValueChange={(val) => onUpdateSettings({ selectedModel: val })}
                >
                  <SelectTrigger className="w-52 h-8 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AI_CONFIG.AVAILABLE_MODELS.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name || m.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {activeProvider === 'gemini' && (
              <div className="flex items-center justify-between pt-2 border-t border-border/40">
                <div>
                  <Label className="text-xs font-semibold text-foreground">Automatic Model Fallback</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Fall back to next available model if primary encounters rate limits
                  </p>
                </div>
                <Switch
                  checked={settings.modelFallback}
                  onCheckedChange={(val) => onUpdateSettings({ modelFallback: val })}
                />
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
