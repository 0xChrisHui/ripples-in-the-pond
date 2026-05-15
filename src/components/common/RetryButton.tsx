interface Props {
  onClick: () => void;
  loading?: boolean;
  children?: string;
}

export default function RetryButton({
  onClick,
  loading = false,
  children = '重试',
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="rounded-full border border-white/20 px-4 py-1.5 text-xs text-white/70 transition hover:border-white/40 hover:text-white disabled:cursor-not-allowed disabled:text-white/25"
    >
      {loading ? '重试中...' : children}
    </button>
  );
}
