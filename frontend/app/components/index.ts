// Re-export all components for easy importing
export * from './types';
export { MarkdownContent } from './MarkdownContent';
export { CitationsDisplay } from './CitationsDisplay';
export { SupportModal } from './SupportModal';

// Re-export commonly used Lucide icons (optional - can import directly from lucide-react)
export {
  MapPin as LocationIcon,
  Clock as ClockIcon,
  Ticket as TicketIcon,
  BookOpen as BookIcon,
  Users as GroupIcon,
  Heart as HeartIcon,
  Send as SendIcon,
  ExternalLink as LinkIcon,
  X as CloseIcon,
  Expand as ExpandIcon,
  FileText as DocumentIcon,
} from 'lucide-react';
