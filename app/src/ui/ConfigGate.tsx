import React from 'react';
import { apiConfigError } from '../config/env';
import { ConfigErrorScreen } from './ConfigErrorScreen';

/**
 * Renders the app only when the build has a usable API endpoint; otherwise explains the build problem.
 * A release without a valid https PRODUCTION_API_URL must say so immediately, not fail later at login.
 */
export function ConfigGate({ children }: { children: React.ReactNode }) {
  const configError = apiConfigError();
  return configError ? <ConfigErrorScreen message={configError} /> : <>{children}</>;
}
