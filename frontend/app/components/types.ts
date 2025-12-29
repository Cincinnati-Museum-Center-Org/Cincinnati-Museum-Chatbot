// Shared types for the chat application

export interface RetrievedReference {
  content: {
    text?: string;
  };
  location: {
    type: string;
    uri?: string;
    url?: string;
  };
  metadata?: Record<string, string>;
}

export interface Citation {
  retrievedReferences: RetrievedReference[];
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  citations?: Citation[];
}

export interface MediaSource {
  title: string;
  collection?: string;
  dates?: string;
  subjects?: string;
  description?: string;
  source?: string;
  contentType?: string;
  mediaUrl: string;
  mediaType: 'image' | 'video' | 'document';
}

export interface WebSource {
  url: string;
  title: string;
}
