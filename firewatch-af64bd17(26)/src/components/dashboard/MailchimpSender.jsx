
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Send, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { getMailchimpAudiences } from "@/api/functions";
import { sendMailchimpCampaign } from "@/api/functions";

export default function MailchimpSender({ articles, categories }) {
  const [audiences, setAudiences] = useState([]);
  const [selectedAudience, setSelectedAudience] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [subject, setSubject] = useState("Bulletin d'information");
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchAudiences = async () => {
      try {
        const { data } = await getMailchimpAudiences();
        setAudiences(data);
      } catch (e) {
        toast({ title: "Erreur Mailchimp", description: "Impossible de charger les audiences.", variant: "destructive" });
      }
    };
    fetchAudiences();
  }, [toast]);

  const generateHtmlContent = (articlesToSend) => {
    const today = new Date().toLocaleDateString('fr-CA', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    let html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc;">
      <!-- Header with Professional Branding -->
      <div style="background: linear-gradient(135deg, #1e40af, #0f172a); color: white; padding: 30px 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 32px; font-weight: bold;">📰 REVUE DE PRESSE</h1>
        <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Catapulte Communication</p>
        <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.8;">${today}</p>
      </div>
      
      <!-- Content Section -->
      <div style="background: white; padding: 20px;">
        <h2 style="color: #1e40af; border-bottom: 3px solid #1e40af; padding-bottom: 10px; margin-bottom: 25px;">
          ${getCategoryLabel(selectedCategory)}
        </h2>`;
        
    articlesToSend.forEach(article => {
      html += `
        <div style="margin-bottom: 30px; padding: 20px; border-left: 4px solid #1e40af; background: #f8fafc;">
          <h3 style="margin: 0 0 10px 0; color: #0f172a;">
            <a href="${article.url}" style="color: #1e40af; text-decoration: none;">${article.title}</a>
          </h3>
          <p style="margin: 0 0 10px 0; color: #64748b; font-size: 12px;">
            📅 ${new Date(article.publication_date).toLocaleDateString('fr-CA')} | 
            🔗 Source: ${getSourceName(article.source_id)}
          </p>
          ${article.summary ? `<p style="margin: 0; color: #374151; line-height: 1.6;">${article.summary}</p>` : ''}
        </div>`;
    });

    html += `
      </div>
      
      <!-- Footer -->
      <div style="background: #e2e8f0; padding: 20px; text-align: center; color: #64748b;">
        <p style="margin: 0; font-size: 12px;">
          📧 Info@catapultecommunication.com | 📞 (418) 545-4373
        </p>
        <p style="margin: 5px 0 0 0; font-size: 11px;">
          © Catapulte Communication - Tous droits réservés
        </p>
      </div>
    </div>`;
    
    return html;
  };

  const getCategoryLabel = (category) => {
    const labels = {
      AssembleeNationale: "🏛️ ASSEMBLÉE NATIONALE",
      Politics: "⚖️ POLITIQUE",
      Politique: "⚖️ POLITIQUE", // Added for new category option
      Economie: "💰 ÉCONOMIE", // Added for new category option
      Environment: "🌱 ENVIRONNEMENT",
      Environnement: "🌱 ENVIRONNEMENT", // Added for new category option
      Health: "🏥 SANTÉ", 
      Santé: "🏥 SANTÉ", // Added for new category option
      Education: "📚 ÉDUCATION",
      Éducation: "📚 ÉDUCATION", // Added for new category option
      SaguenayLacStJean: "🏔️ SAGUENAY-LAC-ST-JEAN",
      "Saguenay-Lac-St-Jean": "🏔️ SAGUENAY-LAC-ST-JEAN" // Added for new category option
    };
    return labels[category] || "📰 ACTUALITÉS";
  };

  const getSourceName = (sourceId) => {
    // This would need to be passed as a prop or fetched
    return "Source"; // Placeholder
  };
  
  const handleSend = async () => {
    if (!selectedAudience || !selectedCategory || !subject) {
      toast({ title: "Champs manquants", description: "Veuillez sélectionner une catégorie, une audience et un sujet.", variant: "destructive" });
      return;
    }
    
    setIsSending(true);
    
    // Support pour les catégories multiples
    const articlesToSend = articles.filter(a => {
      const articleCategories = Array.isArray(a.categories) 
        ? a.categories 
        : (a.category ? [a.category] : []);
      return articleCategories.includes(selectedCategory);
    });
    
    if (articlesToSend.length === 0) {
      toast({ title: "Aucun article", description: "Aucun article trouvé dans cette catégorie.", variant: "destructive" });
      setIsSending(false);
      return;
    }
    
    const html_content = generateHtmlContent(articlesToSend);

    try {
        await sendMailchimpCampaign({ 
          subject, 
          html_content, 
          list_id: selectedAudience, 
          from_name: "Catapulte Communication", 
          reply_to: "info@catapultecommunication.com" 
        });
        toast({ title: "Campagne envoyée!", description: `Bulletin envoyé avec ${articlesToSend.length} articles.` });
    } catch (e) {
        toast({ title: "Erreur d'envoi", description: e.data?.error || "La campagne n'a pas pu être envoyée.", variant: "destructive" });
    }
    setIsSending(false);
  };

  const categoryOptions = [
    { value: "Politique", label: "⚖️ Politique" },
    { value: "Économie", label: "💰 Économie" },
    { value: "Environnement", label: "🌱 Environnement" },
    { value: "Santé", label: "🏥 Santé" },
    { value: "Éducation", label: "📚 Éducation" },
    { value: "Saguenay-Lac-St-Jean", label: "🏔️ Saguenay-Lac-St-Jean" }
  ];

  return (
    <Card className="border border-slate-200 bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-orange-500" /> Envoyer un bulletin Mailchimp
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Catégorie à envoyer</Label>
          <Select onValueChange={setSelectedCategory}>
            <SelectTrigger><SelectValue placeholder="Choisir une catégorie..." /></SelectTrigger>
            <SelectContent>
              {categoryOptions.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Audience Mailchimp</Label>
          <Select onValueChange={setSelectedAudience} disabled={!audiences.length}>
            <SelectTrigger><SelectValue placeholder={audiences.length ? "Choisir une audience..." : "Chargement..."} /></SelectTrigger>
            <SelectContent>
              {audiences.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.name} ({a.member_count})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
            <Label>Sujet de l'email</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} />
        </div>
        <Button onClick={handleSend} disabled={isSending} className="w-full bg-orange-500 hover:bg-orange-600">
          {isSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
          Envoyer la campagne
        </Button>
      </CardContent>
    </Card>
  );
}
