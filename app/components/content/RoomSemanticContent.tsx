import type { ReactNode } from 'react';

/**
 * Full-screen rooms remain complete HTML documents. Keyboard focus reveals this
 * content as a readable panel while crawlers and assistive technology receive
 * the same approved copy and links as visitors on conventional pages.
 */
export function RoomSemanticContent({ children }: { children: ReactNode }) {
  return <div className="room-semantic-content">{children}</div>;
}
