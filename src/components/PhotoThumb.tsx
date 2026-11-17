import type { ReactNode } from 'react';

interface PhotoThumbProps {
  thumb?: string;
  label?: string;
  caption?: string;
  className?: string;
  alt?: string;
  children?: ReactNode;
}

export function PhotoThumb({ thumb, label = '照片', caption, className = 'thumb', alt, children }: PhotoThumbProps) {
  return (
    <div className={className}>
      {thumb ? (
        <img src={thumb} alt={alt ?? label} loading="lazy" />
      ) : (
        <span>
          {label}
          {caption ? <small>{caption}</small> : null}
        </span>
      )}
      {children}
    </div>
  );
}
