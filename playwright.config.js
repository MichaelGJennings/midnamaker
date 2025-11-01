import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    permissions: ['midi', 'midi-sysex']
  }
});