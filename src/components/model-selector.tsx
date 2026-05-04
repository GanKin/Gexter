'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Circle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { PROVIDERS, resolveProvider } from '@/providers';
import { getModelDisplayName, getModelsForProvider } from '@/utils/model';

type ModelSelectorProps = {
  currentModel: string;
  onModelChange: (model: string, provider: string) => void;
};

const VISIBLE_PROVIDER_IDS = ['openai', 'anthropic', 'google', 'xai', 'moonshot', 'deepseek'];

export function ModelSelector({ currentModel, onModelChange }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<'providers' | 'models'>('providers');
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const currentProviderId = resolveProvider(currentModel).id;

  const visibleProviders = useMemo(
    () => PROVIDERS.filter((provider) => VISIBLE_PROVIDER_IDS.includes(provider.id)),
    [],
  );

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setView('providers');
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const openSelector = () => {
    setIsOpen(true);
    setView('providers');
    setSelectedProvider(resolveProvider(currentModel).id);
  };

  const closeSelector = () => {
    setIsOpen(false);
    setView('providers');
  };

  const handleProviderSelect = (providerId: string) => {
    setSelectedProvider(providerId);
    setView('models');
  };

  const handleModelSelect = (modelId: string) => {
    if (!selectedProvider) {
      return;
    }

    onModelChange(modelId, selectedProvider);
    closeSelector();
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => {
          if (isOpen) {
            closeSelector();
            return;
          }
          openSelector();
        }}
        className="flex w-full items-center justify-between rounded-xl border border-border bg-background/80 px-4 py-3 text-left transition-colors hover:bg-accent/60"
      >
        <div className="flex min-w-0 items-center gap-3">
          <Circle aria-hidden="true" className="h-2.5 w-2.5 fill-emerald-500 text-emerald-500" />
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Model</p>
            <p className="truncate text-sm font-medium">{getModelDisplayName(currentModel)}</p>
          </div>
        </div>
        <ChevronRight
          aria-hidden="true"
          className={cn('h-4 w-4 text-muted-foreground transition-transform', isOpen && 'rotate-90')}
        />
      </button>

      {isOpen ? (
        <Card className="absolute left-0 top-full z-20 mt-2 w-full space-y-1 p-2 shadow-lg">
          {view === 'providers' ? (
            <>
              {visibleProviders.map((provider) => {
                const isActive = provider.id === currentProviderId;
                return (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => handleProviderSelect(provider.id)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-secondary',
                      isActive && 'bg-primary/10 text-primary',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className={cn('text-xs', isActive ? 'text-primary' : 'text-muted-foreground')}>
                        {isActive ? '●' : '○'}
                      </span>
                      <span className="truncate">{provider.displayName}</span>
                    </span>
                    {isActive ? <Badge variant="outline">current</Badge> : null}
                  </button>
                );
              })}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setView('providers')}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary"
              >
                <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                返回
              </button>
              {getModelsForProvider(selectedProvider ?? '').map((model) => {
                const isCurrent = model.id === currentModel;
                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => handleModelSelect(model.id)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-secondary',
                      isCurrent && 'bg-primary/10 text-primary',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className={cn('text-xs', isCurrent ? 'text-primary' : 'text-muted-foreground')}>
                        {isCurrent ? '●' : '○'}
                      </span>
                      <span className="truncate">{model.displayName}</span>
                    </span>
                    {isCurrent ? <Badge variant="outline">(default)</Badge> : null}
                  </button>
                );
              })}
            </>
          )}
        </Card>
      ) : null}
    </div>
  );
}
