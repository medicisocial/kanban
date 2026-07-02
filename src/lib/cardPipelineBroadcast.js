const CHANNEL_NAME = 'medici-card-pipeline-v1';

let channel = null;

function getChannel() {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!channel) {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
    } catch {
      channel = null;
    }
  }
  return channel;
}

/** Tell other staff tabs to refetch cards after a pipeline write lands in the cloud. */
export function broadcastCardPipelineRefresh(cardIds = []) {
  const bus = getChannel();
  if (!bus) return;
  bus.postMessage({
    type: 'cards-changed',
    ids: (cardIds || []).map(String).filter(Boolean),
    at: Date.now(),
  });
}

/** Refetch cards when another tab moves content through the pipeline. */
export function subscribeCardPipelineRefresh(onRefresh) {
  const bus = getChannel();
  if (!bus || typeof onRefresh !== 'function') return () => {};

  const handler = (event) => {
    if (event?.data?.type !== 'cards-changed') return;
    onRefresh(event.data);
  };

  bus.addEventListener('message', handler);
  return () => bus.removeEventListener('message', handler);
}
