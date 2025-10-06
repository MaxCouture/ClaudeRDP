import React from 'react';
import { User, Search, Check } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

export default function PdQSpeakerSelect({ speakerText, selectedDeputeId, deputes, onChange }) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState("");
  
  const selectedDepute = deputes.find(d => d.id === selectedDeputeId);
  
  // Filtrer les députés selon la recherche
  const filteredDeputes = React.useMemo(() => {
    if (!searchValue) return deputes;
    
    const search = searchValue.toLowerCase();
    return deputes.filter(depute => {
      const nomComplet = depute.nomComplet.toLowerCase();
      const circonscription = depute.circonscription.toLowerCase();
      const parti = depute.allegeanceAbrege.toLowerCase();
      
      return nomComplet.includes(search) || 
             circonscription.includes(search) || 
             parti.includes(search);
    });
  }, [deputes, searchValue]);
  
  return (
    <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
      {/* Photo du député */}
      <div className="flex-shrink-0">
        {selectedDepute?.photoUrl ? (
          <img 
            src={selectedDepute.photoUrl} 
            alt={selectedDepute.nomComplet}
            className="w-14 h-14 rounded-full object-cover border-2 border-purple-300"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center border-2 border-gray-300">
            <User className="w-7 h-7 text-gray-400" />
          </div>
        )}
      </div>
      
      {/* Dropdown de sélection avec recherche */}
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-500 mb-1">
          Détecté : <span className="font-medium text-gray-700">{speakerText}</span>
        </div>
        
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between"
            >
              {selectedDepute ? (
                <span className="truncate">
                  {selectedDepute.nomComplet} ({selectedDepute.allegeanceAbrege})
                </span>
              ) : (
                <span className="text-gray-500">Sélectionner le député...</span>
              )}
              <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-0" align="start">
            <Command>
              <CommandInput 
                placeholder="Rechercher par nom, circonscription..." 
                value={searchValue}
                onValueChange={setSearchValue}
              />
              <CommandList>
                <CommandEmpty>Aucun député trouvé.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value=""
                    onSelect={() => {
                      onChange("");
                      setOpen(false);
                      setSearchValue("");
                    }}
                  >
                    <Check
                      className={`mr-2 h-4 w-4 ${!selectedDeputeId ? "opacity-100" : "opacity-0"}`}
                    />
                    <span className="text-gray-500">Non identifié</span>
                  </CommandItem>
                  
                  {filteredDeputes.map((depute) => (
                    <CommandItem
                      key={depute.id}
                      value={`${depute.nomComplet} ${depute.circonscription} ${depute.allegeanceAbrege}`}
                      onSelect={() => {
                        onChange(depute.id);
                        setOpen(false);
                        setSearchValue("");
                      }}
                    >
                      <Check
                        className={`mr-2 h-4 w-4 ${
                          selectedDeputeId === depute.id ? "opacity-100" : "opacity-0"
                        }`}
                      />
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {depute.photoUrl ? (
                          <img 
                            src={depute.photoUrl} 
                            alt={depute.nomComplet}
                            className="w-8 h-8 rounded-full object-cover border border-gray-200 flex-shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center border border-gray-200 flex-shrink-0">
                            <User className="w-4 h-4 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{depute.nomComplet}</div>
                          <div className="text-xs text-gray-500 truncate">
                            {depute.circonscription} • {depute.allegeanceAbrege}
                          </div>
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}