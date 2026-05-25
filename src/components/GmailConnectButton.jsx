import { useGmail } from '../hooks/useGmail';

export default function GmailConnectButton() {
  const { isConnected, accountEmail, connect, disconnect } = useGmail();

  if (isConnected) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden text-xs text-green-400/90 sm:inline" title={accountEmail}>
          Gmail connected
        </span>
        <button
          type="button"
          onClick={disconnect}
          className="rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-400 transition hover:border-white/20 hover:text-white"
          title={`Connected as ${accountEmail}. Click to disconnect.`}
        >
          Disconnect Gmail
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => connect()}
      className="rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-300 transition hover:border-white/20 hover:text-white"
    >
      Connect Gmail
    </button>
  );
}
