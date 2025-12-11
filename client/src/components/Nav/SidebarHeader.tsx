import React from 'react';
import { cn } from '~/utils';

export default function SidebarHeader() {
  const sidebarTitle = 'Apuni Sarkar';
  const sidebarSubtitle = 'Chat bot';

  return (
    <div
      className={cn('mb-4 flex items-center gap-3 rounded-lg px-3 py-3')}
      style={{
        backgroundColor: 'var(--sidebar-active-bg)',
      }}
    >
      <img
        src="/images/logo-small.png"
        alt="Logo"
        className="h-10 w-10 flex-shrink-0 object-contain"
      />
      <div className="flex flex-col">
        <h2 className="text-base font-semibold leading-tight">{sidebarTitle}</h2>
        <p className="text-xs leading-tight" style={{ color: 'var(--sidebar-text-secondary)' }}>
          {sidebarSubtitle}
        </p>
      </div>
    </div>
  );
}
