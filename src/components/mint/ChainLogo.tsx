/** 链标志只承担快速识别；文本名称仍是无障碍与业务真值。 */
export default function ChainLogo({ chainId }: { chainId: number }) {
  const ethereum = chainId === 1 || chainId === 11155111;
  return (
    <span className="chain-logo" data-family={ethereum ? 'ethereum' : 'optimism'} aria-hidden="true">
      {ethereum ? (
        <svg viewBox="0 0 32 32" focusable="false">
          <path d="M16 2 7 16 16 21 25 16 16 2Z" fill="currentColor" opacity=".92" />
          <path d="M16 2v19l9-5L16 2Z" fill="currentColor" opacity=".5" />
          <path d="M7 18.2 16 30v-7.1l-9-4.7Z" fill="currentColor" opacity=".72" />
          <path d="M16 22.9V30l9-11.8-9 4.7Z" fill="currentColor" opacity=".38" />
        </svg>
      ) : (
        <svg viewBox="0 0 32 32" focusable="false">
          <circle cx="16" cy="16" r="15" fill="#ff0420" />
          <text x="16" y="19.2" fill="white" fontFamily="Arial, sans-serif" fontSize="8.5"
            fontWeight="800" letterSpacing="-.6" textAnchor="middle">OP</text>
        </svg>
      )}
    </span>
  );
}
