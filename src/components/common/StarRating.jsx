import React from 'react';
import { Star } from 'lucide-react';

export default function StarRating({ rating = 0, max = 5, size = 14, className = '' }) {
  const roundedRating = Math.round(rating);
  return (
    <div className={`flex items-center gap-0.5 ${className}`} aria-label={`${rating} trên ${max} sao`}>
      {Array.from({ length: max }, (_, i) => (
        <Star 
          key={i} 
          size={size} 
          className={i < roundedRating ? 'fill-amber-500 text-amber-500 stroke-amber-500' : 'text-slate-200 stroke-slate-300'} 
        />
      ))}
    </div>
  );
}
