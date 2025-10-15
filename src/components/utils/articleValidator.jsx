export const validateArticle = (article) => {
  const errors = [];
  
  // Validation ID
  if (!article.id) {
    errors.push('Missing article ID');
    return { isValid: false, errors, sanitized: null };
  }
  
  // Validation titre
  if (!article.title || typeof article.title !== 'string') {
    errors.push('Invalid or missing title');
  }
  
  // Validation date
  let sanitizedDate = article.publication_date;
  if (article.publication_date) {
    try {
      const parsedDate = new Date(article.publication_date);
      const now = new Date();
      
      // Date dans le futur
      if (parsedDate > now) {
        console.warn(`Article ${article.id} a une date future, correction à maintenant`);
        sanitizedDate = now.toISOString();
      }
      
      // Date trop ancienne (> 1 an)
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      if (parsedDate < oneYearAgo) {
        console.warn(`Article ${article.id} a une date > 1 an`);
      }
      
      // Date invalide
      if (isNaN(parsedDate.getTime())) {
        errors.push('Invalid publication_date');
        sanitizedDate = now.toISOString();
      }
    } catch (e) {
      errors.push('Error parsing publication_date');
      sanitizedDate = new Date().toISOString();
    }
  } else {
    sanitizedDate = new Date().toISOString();
  }
  
  // Validation source
  if (!article.source_id) {
    errors.push('Missing source_id');
  }
  
  // Article sanitisé
  const sanitized = {
    ...article,
    title: article.title || 'Sans titre',
    publication_date: sanitizedDate,
    _searchTitle: (article.title || '').toLowerCase(),
    _timestamp: new Date(sanitizedDate).getTime(),
    categories: Array.isArray(article.categories) ? article.categories : [],
    content: article.content || '',
    summary: article.summary || ''
  };
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitized
  };
};

export const validateAndSanitizeArticles = (articles) => {
  const valid = [];
  const invalid = [];
  
  articles.forEach(article => {
    const result = validateArticle(article);
    
    if (result.sanitized) {
      valid.push(result.sanitized);
      
      if (result.errors.length > 0) {
        console.warn(`Article ${article.id} sanitisé:`, result.errors);
      }
    } else {
      invalid.push({ article, errors: result.errors });
      console.error(`Article ${article.id} invalide:`, result.errors);
    }
  });
  
  return { valid, invalid };
};