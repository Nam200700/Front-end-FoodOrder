import React from 'react';

export function SkeletonRestaurantCard() {
  return (
    <div className="bg-white rounded-radius-xl p-4 border border-slate-100/80 shadow-sm animate-pulse space-y-3">
      <div className="w-full h-36 bg-slate-200 rounded-radius-lg"></div>
      <div className="space-y-2">
        <div className="h-4 bg-slate-200 rounded w-2/3"></div>
        <div className="h-3 bg-slate-200 rounded w-1/2"></div>
        <div className="h-3 bg-slate-200 rounded w-1/4"></div>
      </div>
    </div>
  );
}

export function SkeletonOrderCard() {
  return (
    <div className="bg-white rounded-radius-xl p-5 border border-slate-200/60 shadow-sm animate-pulse flex flex-col sm:flex-row gap-4 justify-between">
      <div className="flex gap-4 min-w-0 flex-1">
        <div className="w-16 h-16 bg-slate-200 rounded-radius-md shrink-0"></div>
        <div className="flex-grow space-y-2">
          <div className="h-4 bg-slate-200 rounded w-1/3"></div>
          <div className="h-3 bg-slate-200 rounded w-3/4"></div>
          <div className="h-3 bg-slate-200 rounded w-1/2 mt-2"></div>
        </div>
      </div>
      <div className="w-20 h-8 bg-slate-200 rounded-radius-full self-end sm:self-start"></div>
    </div>
  );
}

export function SkeletonChatMessage() {
  return (
    <div className="flex gap-3 p-4 animate-pulse border-b border-slate-50">
      <div className="w-10 h-10 bg-slate-200 rounded-full shrink-0"></div>
      <div className="flex-grow space-y-2">
        <div className="flex justify-between items-center">
          <div className="h-4 bg-slate-200 rounded w-1/4"></div>
          <div className="h-3 bg-slate-200 rounded w-12"></div>
        </div>
        <div className="h-3 bg-slate-200 rounded w-2/3"></div>
      </div>
    </div>
  );
}

export function SkeletonNotificationCard() {
  return (
    <div className="bg-white rounded-radius-xl p-4 border border-slate-150 animate-pulse flex gap-3.5">
      <div className="w-10 h-10 bg-slate-200 rounded-full shrink-0"></div>
      <div className="flex-grow space-y-2">
        <div className="h-4 bg-slate-200 rounded w-1/3"></div>
        <div className="h-3 bg-slate-200 rounded w-5/6"></div>
        <div className="h-3 bg-slate-200 rounded w-1/4"></div>
      </div>
    </div>
  );
}
