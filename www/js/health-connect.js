function getNativePlugin() {
  return window.Capacitor?.Plugins?.HealthConnect || null;
}

export async function getHealthConnectStatus() {
  const plugin = getNativePlugin();
  if (!plugin) {
    return { available: false, connected: false, message: 'Health Connect is available in the Android app.' };
  }
  try {
    return await plugin.getStatus();
  } catch (error) {
    return { available: false, connected: false, message: 'Health Connect could not be checked.' };
  }
}

export async function requestHealthConnectPermission() {
  const plugin = getNativePlugin();
  if (!plugin) throw new Error('Health Connect requires the Android app.');
  return plugin.requestStepsPermission();
}

export async function readHealthConnectSteps(startDate, endDate) {
  const plugin = getNativePlugin();
  if (!plugin) throw new Error('Health Connect requires the Android app.');
  const result = await plugin.readDailySteps({ startDate, endDate });
  return Array.isArray(result.records) ? result.records : [];
}