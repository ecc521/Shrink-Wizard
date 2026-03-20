const GA_ENDPOINT = "https://www.google-analytics.com/mp/collect";
const MEASUREMENT_ID = "G-JCZSPHWX0G";
const API_SECRET = "RTMX1FAqTl2Ne86OOD6yKg";

/**
 * Sends a server-side event to Google Analytics 4 via the Measurement Protocol.
 *
 * We use this instead of the standard web SDK because Electron apps load from file://
 * in production, which is not supported by standard GA SDKs.
 *
 * This implementation is strictly designed for anonymous usage: it uses a random
 * client ID uniquely generated per installation and does not transmit any PII.
 */
export async function trackEvent(
  clientId: string,
  eventName: string,
  params: Record<string, any> = {},
) {
  if (!clientId) {
    return;
  }

  const payload = {
    client_id: clientId,
    events: [
      {
        name: eventName,
        params: {
          ...params,
        },
      },
    ],
  };

  try {
    const response = await fetch(
      `${GA_ENDPOINT}?measurement_id=${MEASUREMENT_ID}&api_secret=${API_SECRET}`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      console.error(
        `[Analytics] Failed to log event ${eventName}: ${response.statusText}`,
      );
    } else if (process.env.NODE_ENV === "development") {
      console.log(`[Analytics] Logged GA event: ${eventName}`);
    }
  } catch (error) {
    console.error(`[Analytics] Error logging event ${eventName}`, error);
  }
}
