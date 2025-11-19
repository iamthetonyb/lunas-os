import 'server-only';
import Ably from 'ably/promises';

let ablyRest: any | null = null;

function getAblyRest(): any | null {
  if (!process.env.ABLY_API_KEY) {
    return null;
  }
  if (!ablyRest) {
    ablyRest = new Ably.Rest.Promise({
      key: process.env.ABLY_API_KEY,
    });
  }
  return ablyRest;
}

export async function publishOrgEvent(
  orgId: string,
  type: string,
  payload: unknown
): Promise<void> {
  const rest = getAblyRest();
  if (!rest) return;
  await rest.channels.get(`org:${orgId}`).publish(type, payload);
}
