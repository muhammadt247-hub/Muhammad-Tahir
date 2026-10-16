'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSettings } from '@/hooks/useSettings';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import { useAuth } from '@/components/AuthProvider';
import {
  clearAllDoctorXStorage,
  exportAllDoctorXData,
  importDoctorXData,
} from '@/lib/storage';
import { downloadBlob } from '@/lib/csv';
import { toast } from 'sonner';
import { Trash2, Download, Upload, Check, Loader2 } from 'lucide-react';
import { SortOption, ContentTypeFilter } from '@/types/asset';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { user, profile, updateProfileName } = useAuth();
  const { settings, updateSettings } = useSettings();
  const { clearHistory } = useSearchHistory();
  const { theme, setTheme } = useTheme();

  const [name, setName] = useState(profile?.display_name || settings.displayName);
  const [importText, setImportText] = useState('');
  const [showImportArea, setShowImportArea] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile?.display_name) {
      setName(profile.display_name);
    }
  }, [profile?.display_name]);

  const handleSave = async () => {
    setIsSaving(true);
    const finalName = name.trim() || 'Microstock Creator';
    updateSettings({ displayName: finalName });

    if (user) {
      const res = await updateProfileName(finalName);
      if (!res.success) {
        setIsSaving(false);
        toast.error(res.error || 'Failed to update profile name in account');
        return;
      }
    }

    setIsSaving(false);
    toast.success('Settings and profile saved');
    onOpenChange(false);
  };

  const handleClearHistory = () => {
    clearHistory();
    toast.success('Search history cleared');
  };

  const handleClearAllData = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    clearAllDoctorXStorage();
    toast.success('All local storage cleared. Refreshing...');
    setTimeout(() => {
      window.location.reload();
    }, 800);
  };

  const handleExportData = () => {
    const jsonStr = exportAllDoctorXData();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadBlob(blob, `doctorx_backup_${dateStr}.json`);
    toast.success('Workspace exported to JSON');
  };

  const handleImportData = () => {
    if (!importText.trim()) return;
    const ok = importDoctorXData(importText);
    if (ok) {
      toast.success('Workspace data imported successfully! Reloading...');
      setTimeout(() => window.location.reload(), 800);
    } else {
      toast.error('Invalid JSON format');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>Workspace Settings</DialogTitle>
          <DialogDescription>
            Personalize your toolkit preferences and account display name.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Display Name - Saves to Supabase profiles table */}
          <div className="space-y-1.5">
            <Label htmlFor="display-name" className="flex items-center justify-between">
              <span>Display Name</span>
              {user && (
                <span className="text-[10px] text-primary font-medium">
                  Saves to Account
                </span>
              )}
            </Label>
            <Input
              id="display-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Elena Rostova"
              disabled={isSaving}
            />
          </div>

          {/* Theme */}
          <div className="space-y-1.5">
            <Label>Interface Theme</Label>
            <Select value={theme} onValueChange={(val) => setTheme(val)}>
              <SelectTrigger>
                <SelectValue placeholder="Select theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light Mode</SelectItem>
                <SelectItem value="dark">Dark Mode</SelectItem>
                <SelectItem value="system">System Preference</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Analytics Default Sort */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Default Sort</Label>
              <Select
                value={settings.defaultSort}
                onValueChange={(val) => updateSettings({ defaultSort: val as SortOption })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nb_downloads">Most Downloads</SelectItem>
                  <SelectItem value="relevance">Relevance</SelectItem>
                  <SelectItem value="creation">Newest First</SelectItem>
                  <SelectItem value="featured">Featured</SelectItem>
                  <SelectItem value="undiscovered">Undiscovered</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Default Content</Label>
              <Select
                value={settings.defaultContentType}
                onValueChange={(val) => updateSettings({ defaultContentType: val as ContentTypeFilter })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Asset Types</SelectItem>
                  <SelectItem value="photo">Photo / Image</SelectItem>
                  <SelectItem value="illustration">Illustration</SelectItem>
                  <SelectItem value="vector">Vector</SelectItem>
                  <SelectItem value="3d">3D Asset</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Default Generator Platform */}
          <div className="space-y-1.5">
            <Label>Default Metadata Platform</Label>
            <Select
              value={settings.defaultGeneratorPlatform}
              onValueChange={(val) =>
                updateSettings({ defaultGeneratorPlatform: val as 'adobe' | 'shutterstock' | 'freepik' | 'generic' })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="adobe">Adobe Stock</SelectItem>
                <SelectItem value="shutterstock">Shutterstock</SelectItem>
                <SelectItem value="freepik">Freepik</SelectItem>
                <SelectItem value="generic">Generic CSV</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Storage & Backup section */}
          <div className="rounded-xl border border-border/50 bg-muted/30 p-3.5 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
              Data &amp; Local Persistence
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportData}
                className="text-xs h-8"
              >
                <Download className="h-3.5 w-3.5" />
                Export Backup (JSON)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowImportArea(!showImportArea)}
                className="text-xs h-8"
              >
                <Upload className="h-3.5 w-3.5" />
                Import Backup
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearHistory}
                className="text-xs h-8 text-muted-foreground"
              >
                Clear Search History
              </Button>
            </div>

            {showImportArea && (
              <div className="space-y-2 pt-2 border-t border-border/40">
                <textarea
                  className="w-full text-xs font-mono p-2 rounded-lg border border-border/60 bg-background h-24 focus:outline-none"
                  placeholder="Paste JSON backup here..."
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                />
                <Button size="sm" onClick={handleImportData} className="w-full text-xs h-8">
                  Confirm Import
                </Button>
              </div>
            )}

            <div className="pt-2 border-t border-border/40">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleClearAllData}
                className="text-xs h-8 w-full justify-center"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {confirmClear ? 'Click again to permanently erase all local data' : 'Clear All Local Data'}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="gap-1.5">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
