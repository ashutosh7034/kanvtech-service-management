import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface Props {
  currentView: string;
  onNavigate: (view: string) => void;
  pageTitle: string;
  children: React.ReactNode;
}

export const Layout: React.FC<Props> = ({ currentView, onNavigate, pageTitle, children }) => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="app-container">
      {mobileSidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <Sidebar
        currentView={currentView}
        onNavigate={onNavigate}
        isOpenMobile={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />
      <div className="main-wrapper">
        <Header
          pageTitle={pageTitle}
          onNavigate={onNavigate}
          onToggleMobileSidebar={() => setMobileSidebarOpen((prev) => !prev)}
        />
        <main className="content-area">{children}</main>
      </div>
    </div>
  );
};

