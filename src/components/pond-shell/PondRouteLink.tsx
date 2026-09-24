'use client';

import Link from 'next/link';
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react';
import { usePondTransition } from './pond-transition';

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string;
  children: ReactNode;
};

/** 保留链接原生语义；只有普通主键点击进入可逆池塘转场。 */
export default function PondRouteLink({ href, children, onClick, onMouseEnter, ...props }: Props) {
  const transition = usePondTransition();
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || !transition || event.button !== 0 || event.metaKey
      || event.ctrlKey || event.shiftKey || event.altKey || props.target === '_blank') return;
    event.preventDefault();
    transition.navigate(href);
  };
  return (
    <Link href={href} {...props} onClick={handleClick}
      onMouseEnter={(event) => { onMouseEnter?.(event); transition?.prefetch(href); }}>
      {children}
    </Link>
  );
}
