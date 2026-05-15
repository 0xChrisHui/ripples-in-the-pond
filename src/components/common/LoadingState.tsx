import LoadingSpinner from './LoadingSpinner';
import RetryButton from './RetryButton';

interface Props {
  title: string;
  slowHint?: string;
  showSlowHint?: boolean;
  showRetry?: boolean;
  error?: boolean;
  retrying?: boolean;
  onRetry: () => void;
}

export default function LoadingState({
  title,
  slowHint,
  showSlowHint = false,
  showRetry = false,
  error = false,
  retrying = false,
  onRetry,
}: Props) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      {!error && <LoadingSpinner />}
      <div className="space-y-2">
        <p className="text-sm text-white/40">
          {error ? '群岛暂时没有回应' : title}
        </p>
        {showSlowHint && !error && slowHint && (
          <p className="text-xs text-white/25">{slowHint}</p>
        )}
      </div>
      {(showRetry || error) && (
        <RetryButton onClick={onRetry} loading={retrying}>
          手动重试
        </RetryButton>
      )}
    </div>
  );
}
