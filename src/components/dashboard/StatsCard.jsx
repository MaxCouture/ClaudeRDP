import React from 'react';
import { Card, CardContent } from "@/components/ui/card";

export default function StatsCard({ title, value, icon: Icon, hexColor = "#64748b", description, onClick }) {
  const isClickable = !!onClick;

  return (
    <div 
      className={isClickable ? "cursor-pointer" : ""}
      onClick={onClick}
    >
      <Card className={`border border-slate-200 bg-white transition-all duration-300 ${isClickable ? "hover:shadow-md hover:border-blue-400 hover:-translate-y-1" : ""}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide truncate">
                {title}
              </p>
              <div className="text-2xl font-bold truncate" style={{ color: 'var(--editorial-navy)' }}>
                {value}
              </div>
              {description && (
                <p className="text-xs text-slate-400 truncate">{description}</p>
              )}
            </div>
            <div 
              className="p-2 rounded-lg flex-shrink-0"
              style={{ backgroundColor: `${hexColor}20` }}
            >
              <Icon 
                className="w-5 h-5"
                style={{ color: hexColor }} 
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}