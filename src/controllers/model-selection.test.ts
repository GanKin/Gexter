import { describe, expect, test } from 'bun:test';
import { ModelSelectionController } from './model-selection.js';

describe('ModelSelectionController', () => {
  test('treats local providers as freeform model input', async () => {
    const errors: string[] = [];
    const controller = new ModelSelectionController((message) => errors.push(message));

    controller.startSelection();
    await controller.handleProviderSelect('local');

    expect(controller.state.appState).toBe('model_input');
    expect(controller.state.pendingProvider).toBe('local');

    controller.handleModelInputSubmit('llama3.1');

    expect(controller.provider).toBe('local');
    expect(controller.model).toBe('local:llama3.1');
    expect(controller.state.appState).toBe('idle');
    expect(errors).toHaveLength(0);
  });
});
