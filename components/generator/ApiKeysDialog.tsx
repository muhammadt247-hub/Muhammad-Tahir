'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Key,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Clock,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import {
  StoredApiKey,
  getStoredApiKeys,
  saveStoredApiKey,
  deleteStoredApiKey,
  GeneratorSavedSettings,
} from '@/lib/generator/db';
import { toast } from 'sonner';

interface ApiKeysDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: GeneratorSavedSettings;
  onUpdateSettings: (partial: Partial<GeneratorSavedSettings>) => void;
  onKeysChanged?: () => void;
}

export function ApiKeysDialog({
  open,
  onOpenChange,
  settings,
  onUpdateSettings,
  onKeysChanged,
}: ApiKeysDialogProps) {
  const [keys, setKeys] = useState<StoredApiKey[]>([]);
  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  const loadKeys = async () => {
    try {
      const stored = await getStoredApiKeys();
      setKeys(stored);
    } catch {
      // Ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    let ignore = false;
    getStoredApiKeys().then((stored) => {
      if (!ignore) {
        setKeys(stored);
        setCurrentTime(Date.now());
        setIsLoading(false);
      }
    }).catch(() => {
      if (!ignore) setIsLoading(false);
    });
    return () => {
      ignore = true;
    };
  }, [open]);

  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newKey.trim();
    if (!trimmed) {
      toast.error('Please enter an API key');
      return;
    }

    if (keys.some((k) => k.key === trimmed)) {
      toast.error('This key has already been added');
      return;
    }

    const defaultLabel = `Key ${keys.length + 1}`;
    const keyItem: StoredApiKey = {
      id: `key_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      key: trimmed,
      label: newLabel.trim() || defaultLabel,
      isActive: true,
      addedAt: Date.now(),
    };

    try {
      await saveStoredApiKey(keyItem);
      setNewKey('');
      setNewLabel('');
      await loadKeys();
      onKeysChanged?.();
      toast.success('API key added successfully');
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Key className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Google Gemini API Keys</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Keys remain private in your browser (IndexedDB) and rotate automatically with cooldowns.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Add Key Form */}
          <form onSubmit={handleAddKey} className="p-4 rounded-xl bg-accent/40 border border-border/50 space-y-3">
            <div className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Add Custom Gemini Key</span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 font-normal"
              >
                Get a free key <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showKey ? 'text' : 'password'}
                    placeholder="AIzaSy..."
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
                Add API Key
              </Button>
            </div>
          </form>

          {/* Stored Keys List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-foreground px-1">
              <span>Configured Keys ({keys.length})</span>
              {keys.length === 0 && (
                <span className="text-[11px] font-normal text-muted-foreground">
                  Using default built-in AI Studio key
                </span>
              )}
            </div>

            {isLoading ? (
              <div className="py-6 text-center text-xs text-muted-foreground">Loading stored keys...</div>
            ) : keys.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-border/60 text-center space-y-1">
                <p className="text-xs text-muted-foreground">
                  No custom keys added. DOCTORx will use the server default Gemini key.
                </p>
                <p className="text-[11px] text-muted-foreground/80">
                  Add your own free Google Gemini keys to bypass shared rate limits and process batches faster.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {keys.map((k) => {
                  const isResting = Boolean(k.restingUntil && k.restingUntil > currentTime);
                  const restingSeconds = isResting ? Math.ceil((k.restingUntil! - currentTime) / 1000) : 0;

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
                              <AlertCircle className="h-2.5 w-2.5" /> Invalid
                            </span>
                          ) : isResting ? (
                            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-medium">
                              <Clock className="h-2.5 w-2.5" /> Resting ({restingSeconds}s)
                            </span>
                          ) : k.isActive ? (
                            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                              <ShieldCheck className="h-2.5 w-2.5" /> Active
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

          {/* Model Options */}
          <div className="p-4 rounded-xl bg-accent/40 border border-border/50 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="text-xs font-semibold text-foreground">AI Model</Label>
                <p className="text-[11px] text-muted-foreground">Default model for metadata & prompt generation</p>
              </div>
              <Select
                value={settings.selectedModel || 'gemini-3.8-flash'}
                onValueChange={(val) => onUpdateSettings({ selectedModel: val })}
              >
                <SelectTrigger className="w-44 h-8 text-xs rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini-3.8-flash">gemini-3.8-flash (Fast)</SelectItem>
                  <SelectItem value="gemini-3.5-flash">gemini-3.5-flash</SelectItem>
                  <SelectItem value="gemini-2.5-flash">gemini-2.5-flash</SelectItem>
                </SelectContent>
              </Select>
            </div>

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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
