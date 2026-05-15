interface Props {
  className?: string;
}

export default function LoadingSpinner({ className = '' }: Props) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-4 w-4 animate-spin rounded-full border border-white/15 border-t-white/70 ${className}`}
    />
  );
}
