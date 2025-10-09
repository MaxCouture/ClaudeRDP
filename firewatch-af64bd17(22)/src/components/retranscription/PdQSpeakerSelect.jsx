import React from 'react';
import { User, Search, Check } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

// Fonction pour normaliser les noms (enlever accents et mettre en minuscules)
const normalizeText = (text) => {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Enlever les accents
};

export default function PdQSpeakerSelect({ speakerText, selectedDeputeId, deputes, onChange }) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState("");
  
  // Trouver le député sélectionné pour afficher sa photo
  const selectedDepute = deputes.find(d => d.id === selectedDeputeId);
  
  // Filtrer les députés selon la recherche
  const filteredDeputes = React.useMemo(() => {
    if (!searchValue.trim()) return deputes;
    
    const normalizedSearch = normalizeText(searchValue);
    
    return deputes.filter(depute => {
      const normalizedNom = normalizeText(depute.nomComplet);
      const normalizedCirconscription = normalizeText(depute.circonscription);
      const normalizedParti = normalizeText(depute.allegeanceAbrege);
      
      return normalizedNom.includes(normalizedSearch) ||
             normalizedCirconscription.includes(normalizedSearch) ||
             normalizedParti.includes(normalizedSearch);
    });
  }, [deputes, searchValue]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
        {/* Photo du député sélectionné OU icône par défaut */}
        {selectedDepute?.photoUrl ? (
          <img 
            src={selectedDepute.photoUrl} 
            alt={selectedDepute.nomComplet}
            className="w-12 h-12 rounded-full object-cover border-2 border-purple-400 flex-shrink-0"
            onError={(e) => {
              console.error('Erreur chargement photo:', selectedDepute.photoUrl);
              e.target.style.display = 'none';
            }}
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center border-2 border-gray-300 flex-shrink-0">
            <User className="w-6 h-6 text-gray-400" />
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <div className="text-sm text-gray-600 truncate">{speakerText}</div>
          {selectedDepute && (
            <div className="text-xs text-purple-600 font-medium truncate">
              {selectedDepute.nomComplet} - {selectedDepute.allegeanceAbrege}
            </div>
          )}
        </div>
        
        {!selectedDeputeId && (
          <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded flex-shrink-0">
            Non identifié
          </span>
        )}
        {selectedDepute && (
          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded flex-shrink-0">
            ✓ Identifié
          </span>
        )}
      </div>
      
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={`w-full justify-between ${!selectedDeputeId ? "border-amber-300 bg-amber-50" : "border-green-300 bg-green-50"}`}
          >
            {selectedDepute ? (
              <span className="flex items-center gap-2 truncate">
                {selectedDepute.photoUrl ? (
                  <img 
                    src={selectedDepute.photoUrl} 
                    alt={selectedDepute.nomComplet}
                    className="w-5 h-5 rounded-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                ) : (
                  <User className="w-4 h-4 text-gray-400" />
                )}
                <span className="font-medium">{selectedDepute.nomComplet}</span>
                <span className="text-xs text-gray-500">({selectedDepute.allegeanceAbrege})</span>
              </span>
            ) : (
              <span className="text-gray-500">⚠️ Sélectionner le vrai député...</span>
            )}
            <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput 
              placeholder="Chercher par nom ou circonscription..." 
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandList>
              <CommandEmpty>Aucun député trouvé.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="none"
                  onSelect={() => {
                    onChange("");
                    setOpen(false);
                    setSearchValue("");
                  }}
                >
                  <span className="text-gray-400">Aucun député sélectionné</span>
                </CommandItem>
                {filteredDeputes.map((depute) => (
                  <CommandItem
                    key={depute.id}
                    value={depute.id}
                    onSelect={() => {
                      console.log('Député sélectionné:', depute.nomComplet, depute.id);
                      onChange(depute.id);
                      setOpen(false);
                      setSearchValue("");
                    }}
                  >
                    <div className="flex items-center gap-2 w-full">
                      {depute.photoUrl ? (
                        <img 
                          src={depute.photoUrl} 
                          alt={depute.nomComplet}
                          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{depute.nomComplet}</div>
                        <div className="text-xs text-gray-500 truncate">
                          {depute.circonscription} - {depute.allegeanceAbrege}
                        </div>
                      </div>
                      {selectedDeputeId === depute.id && (
                        <Check className="w-4 h-4 text-purple-600 flex-shrink-0" />
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}