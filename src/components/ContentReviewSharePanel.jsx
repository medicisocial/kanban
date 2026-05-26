import { useCallback } from 'react';
import { useClientsContext } from '../context/ClientsContext';
import { buildContentReviewShareUrl } from '../utils/contentReviewShare';
import ShareLinkStrip from './ShareLinkStrip';

export default function ContentReviewSharePanel({ cards, clientFilter = 'all' }) {
  const { clients } = useClientsContext();

  const getClientMeta = useCallback(
    (client) => {
      const inReview = cards.filter(
        (c) => c.client === client && c.columnId === 'in-review',
      );
      return {
        count: inReview.length,
        disabled: inReview.length === 0,
        payload: inReview,
      };
    },
    [cards],
  );

  const handleCopy = async (client, inReview) => {
    const url = buildContentReviewShareUrl(client, inReview);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt('Copy this content review link:', url);
    }
  };

  return (
    <ShareLinkStrip
      title="Share review"
      emptyHint="No content in review to share"
      clients={clients}
      clientFilter={clientFilter}
      getClientMeta={getClientMeta}
      onCopy={handleCopy}
    />
  );
}
