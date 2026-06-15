import {
  Menu,
  Plus,
  X,
  Search,
  Bell,
  Send,
  Paperclip,
  MessageCircle,
  Lightbulb,
  FolderClosed,
  Workflow,
  ChevronDown,
  ChevronRight,
  Check,
  ShoppingCart,
  Calendar,
  CalendarDays,
  Users,
  Inbox,
  Package,
  Flower2,
  Store,
  Pin,
  Trash2,
  Pencil,
  RotateCcw,
  Hash,
  Sparkles,
  Heart
} from "lucide-react";

// Borough DS iconography — Lucide, thin stroke (1.75). Registry is keyed by the
// kebab-case names the design uses (data-lucide="...") so components can stay
// declarative: <Icon name="message-circle" />. Outline only.
const REGISTRY = {
  menu: Menu,
  "menu-2": Menu,
  plus: Plus,
  x: X,
  search: Search,
  bell: Bell,
  send: Send,
  paperclip: Paperclip,
  "message-circle": MessageCircle,
  lightbulb: Lightbulb,
  "folder-closed": FolderClosed,
  workflow: Workflow,
  "chevron-down": ChevronDown,
  "chevron-right": ChevronRight,
  check: Check,
  "shopping-cart": ShoppingCart,
  calendar: Calendar,
  "calendar-days": CalendarDays,
  "calendar-event": CalendarDays,
  users: Users,
  inbox: Inbox,
  package: Package,
  flower: Flower2,
  plant: Flower2,
  store: Store,
  "building-store": Store,
  pin: Pin,
  trash: Trash2,
  edit: Pencil,
  "rotate-ccw": RotateCcw,
  hash: Hash,
  sparkles: Sparkles,
  heart: Heart
};

export default function Icon({ name, size = 18, strokeWidth = 1.75, className, label }) {
  const Glyph = REGISTRY[name];
  if (!Glyph) return null;
  return (
    <Glyph
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
    />
  );
}
