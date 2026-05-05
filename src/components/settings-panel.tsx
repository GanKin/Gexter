'use client';

import { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Settings2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { PROVIDERS } from '@/providers';
import { getApiKey, loadPreferences, setApiKey, type ThemePreference } from '@/lib/preferences';
import { useTheme } from '@/hooks/use-theme';

const KEY_PROVIDER_IDS = ['openai', 'anthropic', 'google', 'xai', 'moonshot', 'deepseek'];

export function SettingsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const [apiKeys, setApiKeys] = useState<Record<string, string>>(() => {
    const prefs = loadPreferences();
    return Object.fromEntries(
      KEY_PROVIDER_IDS.map((providerId) => [providerId, prefs.providerSettings[providerId]?.apiKey ?? '']),
    ) as Record<string, string>;
  });
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const timer = window.setTimeout(() => {
      for (const providerId of KEY_PROVIDER_IDS) {
        setApiKey(providerId, apiKeys[providerId] ?? '');
      }
    }, 500);

    return () => window.clearTimeout(timer);
  }, [apiKeys]);

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
        <CardDescription>主题、模型和 API key 都会保存到本地浏览器。</CardDescription>
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
            <h3 className="text-sm font-medium">API Keys</h3>
            <div className="space-y-3">
              {KEY_PROVIDER_IDS.map((providerId) => {
                const provider = PROVIDERS.find((entry) => entry.id === providerId);
                const value = apiKeys[providerId] ?? '';
                const hasKey = value.trim().length > 0 || getApiKey(providerId) !== null;
                const isVisible = visibleKeys[providerId] ?? false;

                return (
                  <label key={providerId} className="block space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">{provider?.displayName ?? providerId}</span>
                      <span
                        className={cn(
                          'h-2 w-2 rounded-full',
                          hasKey ? 'bg-emerald-500' : 'bg-border',
                        )}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type={isVisible ? 'text' : 'password'}
                        value={value}
                        onChange={(event) =>
                          setApiKeys((current) => ({ ...current, [providerId]: event.target.value }))
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
                );
              })}
            </div>
          </section>
        </CardContent>
      ) : null}
    </Card>
  );
}
