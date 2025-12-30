// Internationalization configuration for CincyMuse
// All UI text is controlled from this file for easy localization

export type Language = 'en' | 'es';

export interface Translations {
  // Header
  brandName: string;
  brandTagline: string;
  
  // Language switcher
  english: string;
  spanish: string;
  
  // Welcome message
  welcomeTitle: string;
  welcomeMessage: string;
  
  // Quick actions section
  quickActionsTitle: string;
  planYourVisit: string;
  currentExhibits: string;
  ticketsMembership: string;
  collections: string;
  groupVisits: string;
  supportMuseum: string;
  
  // Chat input
  inputPlaceholder: string;
  
  // Chat messages
  thinking: string;
  errorMessage: string;
  
  // Feedback
  wasThisHelpful: string;
  yesHelpful: string;
  noNotHelpful: string;
  
  // Sources
  sources: string;
  
  // Accessibility
  sendMessage: string;
  chatHistory: string;
  newMessage: string;
}

export const translations: Record<Language, Translations> = {
  en: {
    // Header
    brandName: 'CincyMuse',
    brandTagline: 'Your digital guide',
    
    // Language switcher
    english: 'English',
    spanish: 'Español',
    
    // Welcome message
    welcomeTitle: 'Welcome to CincyMuse!',
    welcomeMessage: "Hi, I'm CincyMuse, your digital guide at Cincinnati Museum Center! Whether you're planning a visit, curious about exhibits, or need help with tickets and membership, I'm here to help. What can I assist you with today?",
    
    // Quick actions section
    quickActionsTitle: 'Quick Actions',
    planYourVisit: 'Plan Your Visit',
    currentExhibits: 'Current Exhibits',
    ticketsMembership: 'Tickets & Membership',
    collections: 'Collections',
    groupVisits: 'Group Visits',
    supportMuseum: 'Support the Museum',
    
    // Chat input
    inputPlaceholder: 'Ask me anything about the museum...',
    
    // Chat messages
    thinking: 'Thinking...',
    errorMessage: 'Sorry, something went wrong. Please try again.',
    
    // Feedback
    wasThisHelpful: 'Was this helpful?',
    yesHelpful: 'Yes, helpful',
    noNotHelpful: 'No, not helpful',
    
    // Sources
    sources: 'Sources',
    
    // Accessibility
    sendMessage: 'Send message',
    chatHistory: 'Chat history',
    newMessage: 'New message',
  },
  es: {
    // Header
    brandName: 'CincyMuse',
    brandTagline: 'Tu guía digital',
    
    // Language switcher
    english: 'English',
    spanish: 'Español',
    
    // Welcome message
    welcomeTitle: '¡Bienvenido a CincyMuse!',
    welcomeMessage: '¡Hola! Soy CincyMuse, tu guía digital en el Centro de Museos de Cincinnati. Ya sea que estés planeando una visita, tengas curiosidad sobre las exhibiciones o necesites ayuda con boletos y membresías, estoy aquí para ayudarte. ¿En qué puedo asistirte hoy?',
    
    // Quick actions section
    quickActionsTitle: 'Acciones Rápidas',
    planYourVisit: 'Planifica tu Visita',
    currentExhibits: 'Exhibiciones Actuales',
    ticketsMembership: 'Boletos y Membresía',
    collections: 'Colecciones',
    groupVisits: 'Visitas en Grupo',
    supportMuseum: 'Apoya al Museo',
    
    // Chat input
    inputPlaceholder: 'Pregúntame cualquier cosa sobre el museo...',
    
    // Chat messages
    thinking: 'Pensando...',
    errorMessage: 'Lo siento, algo salió mal. Por favor, inténtalo de nuevo.',
    
    // Feedback
    wasThisHelpful: '¿Fue útil?',
    yesHelpful: 'Sí, útil',
    noNotHelpful: 'No, no fue útil',
    
    // Sources
    sources: 'Fuentes',
    
    // Accessibility
    sendMessage: 'Enviar mensaje',
    chatHistory: 'Historial de chat',
    newMessage: 'Nuevo mensaje',
  },
};

// Quick action prompts - what gets sent to the API when a quick action is clicked
export const quickActionPrompts: Record<Language, Record<string, string>> = {
  en: {
    planYourVisit: 'I want to plan my visit to the Cincinnati Museum Center. What are your hours, location, and parking options?',
    currentExhibits: 'What are the current exhibits at the Cincinnati Museum Center?',
    ticketsMembership: 'Tell me about ticket prices and membership options at the Cincinnati Museum Center.',
    collections: 'What collections can I explore at the Cincinnati Museum Center?',
    groupVisits: 'I\'m interested in planning a group visit. What options are available?',
    supportMuseum: 'How can I support the Cincinnati Museum Center through donations or volunteering?',
  },
  es: {
    planYourVisit: 'Quiero planificar mi visita al Centro de Museos de Cincinnati. ¿Cuáles son sus horarios, ubicación y opciones de estacionamiento?',
    currentExhibits: '¿Cuáles son las exhibiciones actuales en el Centro de Museos de Cincinnati?',
    ticketsMembership: 'Cuéntame sobre los precios de boletos y opciones de membresía en el Centro de Museos de Cincinnati.',
    collections: '¿Qué colecciones puedo explorar en el Centro de Museos de Cincinnati?',
    groupVisits: 'Estoy interesado en planificar una visita en grupo. ¿Qué opciones están disponibles?',
    supportMuseum: '¿Cómo puedo apoyar al Centro de Museos de Cincinnati a través de donaciones o voluntariado?',
  },
};

// API configuration - uses environment variable
export const getApiConfig = () => {
  const baseUrl = process.env.NEXT_PUBLIC_CHAT_API_URL || '';
  // Derive feedback URL from chat URL (same API, different endpoint)
  const feedbackEndpoint = baseUrl ? baseUrl.replace('/chat', '/feedback') : '';
  
  return {
    chatEndpoint: baseUrl,
    feedbackEndpoint: feedbackEndpoint,
  };
};
