
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Newspaper, Rss, Plus, BarChart3, Settings, Tag, Landmark, Key, Archive, Users, Mail, PenSquare, Mic, AlertTriangle } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const navigationItems = [
  { title: "Fil de nouvelles", url: createPageUrl("Dashboard"), icon: BarChart3 },
  { title: "Retranscription", url: createPageUrl("Retranscription"), icon: Mic },
  { title: "Veille gouvernementale", url: createPageUrl("AssembleeNationale"), icon: Landmark },
  { title: "Envoyer le bulletin", url: createPageUrl("Newsletter"), icon: Mail },
  { title: "Envoyer la PdQ", url: createPageUrl("SendPdQ"), icon: Mic },
  { title: "Archives", url: createPageUrl("Archives"), icon: Archive },
  { title: "Sources", url: createPageUrl("Sources"), icon: Rss },
  { title: "Catégories & Mots-clés", url: createPageUrl("CategoriesKeywords"), icon: Tag },
  { title: "Canaux Teams", url: createPageUrl("TeamsChannels"), icon: AlertTriangle },
];

export default function Layout({ children, currentPageName }) {
  const location = useLocation();

  return (
    <SidebarProvider>
      <style>{`
        :root {
          --editorial-navy: #0f172a;
          --editorial-blue: #1e40af;
          --editorial-gray: #64748b;
          --editorial-light: #f8fafc;
          --editorial-accent: #059669;
        }
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          background: var(--editorial-light);
        }
      `}</style>
      
      <div className="min-h-screen flex w-full" style={{ background: 'var(--editorial-light)' }}>
        <Sidebar className="border-r border-slate-200 bg-white">
          <SidebarHeader className="border-b border-slate-200 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" 
                   style={{ background: 'linear-gradient(135deg, #dc2626, #991b1b)' }}>
                <span className="text-white text-lg">🔥</span>
              </div>
              <div>
                <h2 className="font-bold text-lg" style={{ color: 'var(--editorial-navy)' }}>
                  Firewatch
                </h2>
                <p className="text-xs" style={{ color: 'var(--editorial-gray)' }}>
                  Veille médiatique québécoise
                </p>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="p-4">
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider px-2 py-3" 
                                style={{ color: 'var(--editorial-gray)' }}>
                Analyse
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  {navigationItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        className={`hover:bg-slate-50 transition-all duration-200 rounded-lg px-3 py-2.5 ${
                          location.pathname === item.url 
                            ? 'bg-blue-50 border-l-4 border-l-blue-600 text-blue-700 font-medium' 
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Link to={item.url} className="flex items-center gap-3">
                          <item.icon className="w-5 h-5" />
                          <span className="font-medium">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider px-2 py-3" 
                                style={{ color: 'var(--editorial-gray)' }}>
                Actions rapides
              </SidebarGroupLabel>
              <SidebarGroupContent>
                 <SidebarMenu className="space-y-1">
                    <SidebarMenuItem>
                        <SidebarMenuButton 
                            asChild 
                            className="hover:bg-slate-50 transition-all duration-200 rounded-lg px-3 py-2.5 text-slate-600 hover:text-slate-900"
                        >
                          <Link to={createPageUrl("AddArticle")} className="flex items-center gap-3">
                              <Plus className="w-5 h-5" />
                              <span className="font-medium">Ajouter un article</span>
                          </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton 
                            asChild 
                            className="hover:bg-slate-50 transition-all duration-200 rounded-lg px-3 py-2.5 text-slate-600 hover:text-slate-900"
                        >
                          <Link to={createPageUrl("Settings")} className="flex items-center gap-3">
                              <Settings className="w-5 h-5" />
                              <span className="font-medium">Paramètres</span>
                          </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                 </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <main className="flex-1 flex flex-col">
          <header className="bg-white border-b border-slate-200 px-6 py-4 md:hidden">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-slate-100 p-2 rounded-lg transition-colors duration-200" />
              <h1 className="text-xl font-bold" style={{ color: 'var(--editorial-navy)' }}>
                🔥 Firewatch
              </h1>
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
