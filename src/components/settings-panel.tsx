'use client';

import { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Settings2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { PROVIDERS } from '@/providers';
import {
  loadPreferences,
  savePreference,
  type ProviderConnectionSettings,
  type ProviderConnectionMap,
  type ThemePreference,
} from '@/lib/preferences';
import { useTheme } from '@/hooks/use-theme';

const KEY_PROVIDER_IDS = ['openai', 'anthropic', 'google', 'xai', 'moonshot', 'deepseek'];

const EMPTY_PROVIDER_SETTINGS: ProviderConnectionSettings = {
  apiKey: null,
  baseUrl: null,
  model: null,
};

export function SettingsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const [providerSettings, setProviderSettings] = useState<ProviderConnectionMap>(() => {
    const prefs = loadPreferences();
    return prefs.providerSettings;
  });
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const timer = window.setTimeout(() => {
      savePreference('providerSettings', providerSettings);
    }, 500);

    return () => window.clearTimeout(timer);
  }, [providerSettings]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const themeOptions = useMemo(
    () =>
      [
        { label: '亮色', value: 'light' as ThemePreference },
        { label: '暗色', value: 'dark' as ThemePreference },
        { label: '跟随系统', value: 'system' as ThemePreference },
      ],
    [],
  );

  return (
    <Card className="border-border/80 bg-background/70">
      <CardHeader className="space-y-3 pb-3">
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="flex items-center gap-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <Settings2 className="h-4 w-4" aria-hidden="true" />
          设置
        </button>
        <CardDescription>主题、Base URL、模型名和 API key 都会保存到本地浏览器。</CardDescription>
      </CardHeader>

      {isOpen ? (
        <CardContent className="space-y-4 pt-0">
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">主题</h3>
              <span className="text-xs text-muted-foreground">{theme}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {themeOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={theme === option.value ? 'default' : 'outline'}
                  onClick={() => setTheme(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </section>

          <Separator />

          <section className="space-y-3">
            <h3 className="text-sm font-medium">连接配置</h3>
            <p className="text-xs text-muted-foreground">
              为每个 provider 单独填写连接信息，保存后会自动写入本地浏览器。
            </p>
            <div className="space-y-3">
              {KEY_PROVIDER_IDS.map((providerId) => {
                const provider = PROVIDERS.find((entry) => entry.id === providerId);
                const settings = providerSettings[providerId] ?? EMPTY_PROVIDER_SETTINGS;
                const hasValue =
                  Boolean(settings.apiKey?.trim()) ||
                  Boolean(settings.baseUrl?.trim()) ||
                  Boolean(settings.model?.trim());
                const isVisible = visibleKeys[providerId] ?? false;

                return (
                  <div key={providerId} className="rounded-xl border border-border/70 bg-background/40 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-medium text-muted-foreground">{provider?.displayName ?? providerId}</span>
                      <span
                        className={cn(
                          'h-2 w-2 rounded-full',
                          hasValue ? 'bg-emerald-500' : 'bg-border',
                        )}
                      />
                    </div>
                    <div className="mt-3 space-y-3">
                      <label className="block space-y-1">
                        <span className="text-xs font-medium text-muted-foreground">Base URL</span>
                        <input
                          type="text"
                          value={settings.baseUrl ?? ''}
                          onChange={(event) =>
                            setProviderSettings((current) => ({
                              ...current,
                              [providerId]: {
                                ...(current[providerId] ?? EMPTY_PROVIDER_SETTINGS),
                                baseUrl: event.target.value,
                              },
                            }))
                          }
                          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          placeholder="输入 Base URL，例如 https://api.openai.com/v1"
                        />
                      </label>

                      <label className="block space-y-1">
                        <span className="text-xs font-medium text-muted-foreground">Model</span>
                        <input
                          type="text"
                          value={settings.model ?? ''}
                          onChange={(event) =>
                            setProviderSettings((current) => ({
                              ...current,
                              [providerId]: {
                                ...(current[providerId] ?? EMPTY_PROVIDER_SETTINGS),
                                model: event.target.value,
                              },
                            }))
                          }
                          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          placeholder="输入模型名称，例如 gpt-4.1-mini"
                        />
                      </label>

                      <label className="block space-y-1">
                        <span className="text-xs font-medium text-muted-foreground">API Key</span>
                        <div className="flex items-center gap-2">
                          <input
                            type={isVisible ? 'text' : 'password'}
                            value={settings.apiKey ?? ''}
                            onChange={(event) =>
                              setProviderSettings((current) => ({
                                ...current,
                                [providerId]: {
                                  ...(current[providerId] ?? EMPTY_PROVIDER_SETTINGS),
                                  apiKey: event.target.value,
                                },
                              }))
                            }
                            className="h-10 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            placeholder="输入 API key"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setVisibleKeys((current) => ({ ...current, [providerId]: !current[providerId] }))
                            }
                            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition hover:bg-accent hover:text-foreground"
                            aria-label={`${isVisible ? '隐藏' : '显示'} ${provider?.displayName ?? providerId} API key`}
                          >
                            {isVisible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                          </button>
                        </div>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </CardContent>
      ) : null}
    </Card>
  );
}
