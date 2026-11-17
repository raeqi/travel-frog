interface FrogProps {
  className?: string;
  mood?: 'happy' | 'sleepy';
}

export function FrogIcon({ className = 'frog-svg', mood = 'happy' }: FrogProps) {
  return (
    <svg className={className} viewBox="0 0 140 110" aria-hidden="true">
      <ellipse cx="70" cy="68" rx="42" ry="30" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="46" cy="34" r="16" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="94" cy="34" r="16" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="46" cy="36" r="5" fill="currentColor" />
      <circle cx="94" cy="36" r="5" fill="currentColor" />
      {mood === 'happy' ? (
        <path d="M50 70 Q70 86 90 70" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      ) : (
        <path d="M55 76 Q70 70 85 76" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      )}
      <path d="M34 88 q-8 10 4 12 h22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M106 88 q8 10 -4 12 h-22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="63" cy="55" r="1.5" fill="currentColor" />
      <circle cx="77" cy="55" r="1.5" fill="currentColor" />
    </svg>
  );
}
