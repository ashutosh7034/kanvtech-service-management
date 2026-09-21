import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface Props {
  currentView: string;
  onNavigate: (view: string) => void;
  pageTitle: string;
  children: React.ReactNode;
}

export const Layout: React.FC<Props> = ({ currentView, onNavigate, pageTitle, children }) => {
  return (
    <div className="app-container">
      <Sidebar currentView={currentView} onNavigate={onNavigate} />
      <div className="main-wrapper">
        <Header pageTitle={pageTitle} />
        <main className="content-area">{children}</main>
      </div>
    </div>
  );
};
