import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock } from "lucide-react";

export default function DateFilter({ selectedFilter, onFilterChange, todayCount, allCount }) {
  return (
    <div className="flex items-center gap-3 p-4 bg-white rounded-lg border border-slate-200">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Clock className="w-4 h-4" />
        <span className="font-medium">Filtrer par date:</span>
      </div>
      
      <div className="flex gap-2">
        <Button
          variant={selectedFilter === "today" ? "default" : "outline"}
          size="sm"
          onClick={() => onFilterChange("today")}
          className={selectedFilter === "today" ? "bg-blue-600 hover:bg-blue-700" : ""}
        >
          <Calendar className="w-4 h-4 mr-1" />
          Aujourd'hui
          <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-700">
            {todayCount}
          </Badge>
        </Button>
        
        <Button
          variant={selectedFilter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => onFilterChange("all")}
          className={selectedFilter === "all" ? "bg-slate-600 hover:bg-slate-700" : ""}
        >
          Tous les articles
          <Badge variant="secondary" className="ml-2 bg-slate-100 text-slate-700">
            {allCount}
          </Badge>
        </Button>
      </div>
    </div>
  );
}