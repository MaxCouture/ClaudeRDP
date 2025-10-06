
import React from 'react';
import { User } from "lucide-react"; // Keep User icon
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Add Select components

export default function PdQSpeakerSelect({ speakerText, selectedDeputeId, deputes, onChange }) {
  // Remove open, setOpen, searchValue, setSearchValue as they are not used with the new Select component
  // Remove filteredDeputes memo as it's not needed for the new Select component
  
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border">
        <User className="w-4 h-4 text-gray-400" />
        <span className="text-sm text-gray-600 flex-1">{speakerText}</span>
        {!selectedDeputeId && (
          <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded">
            Non identifié
          </span>
        )}
      </div>
      
      <Select value={selectedDeputeId || ""} onValueChange={onChange}>
        <SelectTrigger className={!selectedDeputeId ? "border-amber-300 bg-amber-50" : ""}>
          <SelectValue placeholder="⚠️ Sélectionner le vrai député..." />
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          <SelectItem value={null}> {/* Use empty string for "Aucun député sélectionné" as Select expects string values */}
            <span className="text-gray-400">Aucun député sélectionné</span>
          </SelectItem>
          {deputes.map((depute) => (
            <SelectItem key={depute.id} value={depute.id}>
              <div className="flex items-center gap-2">
                {depute.photoUrl ? ( // Check if photoUrl exists before rendering img
                  <img 
                    src={depute.photoUrl} 
                    alt={depute.nomComplet}
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : ( // Fallback for no photo
                  <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center border border-gray-200 flex-shrink-0">
                    <User className="w-3 h-3 text-gray-400" />
                  </div>
                )}
                <div>
                  <div className="font-medium">{depute.nomComplet}</div>
                  <div className="text-xs text-gray-500">
                    {depute.circonscription} - {depute.allegeanceAbrege}
                  </div>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
