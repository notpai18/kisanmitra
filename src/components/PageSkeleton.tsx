import React from 'react';

export default function PageSkeleton() {
  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4 md:p-0" aria-busy="true" aria-label="Loading page">
      <div className="skeleton h-28 w-full rounded-2xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="skeleton h-48 w-full rounded-2xl" />
        <div className="skeleton h-48 w-full rounded-2xl" />
        <div className="skeleton h-48 w-full rounded-2xl hidden lg:block" />
      </div>
      <div className="skeleton h-64 w-full rounded-2xl" />
    </div>
  );
}
