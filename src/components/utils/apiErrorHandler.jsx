export const handleApiError = (error, context = '') => {
  console.error(`[API Error - ${context}]`, error);
  
  // Erreurs réseau
  if (!error.response) {
    return {
      title: "Erreur de connexion",
      description: "Impossible de contacter le serveur. Vérifiez votre connexion.",
      shouldRetry: true
    };
  }
  
  // Erreurs Base44
  const status = error.response?.status;
  
  switch (status) {
    case 429: // Rate limit
      return {
        title: "Trop de requêtes",
        description: "Veuillez patienter quelques secondes.",
        shouldRetry: true,
        retryAfter: 5000
      };
    
    case 500:
    case 502:
    case 503:
      return {
        title: "Erreur serveur",
        description: "Le serveur rencontre un problème. Nouvelle tentative automatique...",
        shouldRetry: true,
        retryAfter: 3000
      };
    
    case 404:
      return {
        title: "Ressource introuvable",
        description: "L'élément demandé n'existe plus.",
        shouldRetry: false
      };
    
    case 403:
      return {
        title: "Accès refusé",
        description: "Vous n'avez pas les permissions nécessaires.",
        shouldRetry: false
      };
    
    default:
      return {
        title: "Erreur",
        description: error.response?.data?.error || error.message || "Une erreur est survenue.",
        shouldRetry: false
      };
  }
};

// Helper pour retry automatique
export const withRetry = async (fn, maxRetries = 2, delayMs = 2000) => {
  let lastError;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const errorInfo = handleApiError(error, 'withRetry');
      
      // Ne pas retry si pas nécessaire
      if (!errorInfo.shouldRetry || i === maxRetries) {
        throw error;
      }
      
      console.log(`Retry ${i + 1}/${maxRetries} après ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, errorInfo.retryAfter || delayMs));
    }
  }
  
  throw lastError;
};