import { NavLink } from "react-router-dom";
import {
  CheckCircle,
  Play,
  Wallet,
  Activity,
  Power,
  Settings,
  Bot,
  Zap,
  ArrowLeft,
  List,
  Link as LinkIcon,
  Blocks
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

interface ArbitrageSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const navigationItems = [
  { id: "status", label: "Status APIs", icon: CheckCircle },
  { id: "diagnostic", label: "Diagnóstico", icon: Play },
  { id: "balances", label: "Meus Saldos", icon: Wallet },
  { id: "dashboard", label: "Dashboard", icon: Activity },
  { id: "real-mode", label: "Modo Real", icon: Power },
  { id: "opportunities", label: "Oportunidades", icon: List },
  { id: "auto-config", label: "Config Auto", icon: Bot },
  { id: "cross-automation", label: "Automação Cross", icon: Zap },
  { id: "api-config", label: "APIs", icon: Settings },
  { id: "whitelist", label: "IP Whitelist", icon: CheckCircle },
  { id: "transfers", label: "Transferências", icon: ArrowLeft },
  { id: "conversions", label: "Conversões", icon: ArrowLeft },
  { id: "n8n", label: "n8n", icon: LinkIcon },
  { id: "blockchain", label: "Blockchain", icon: Blocks },
];

export function ArbitrageSidebar({ activeTab, onTabChange }: ArbitrageSidebarProps) {
  const { open } = useSidebar();

  const getButtonClass = (itemId: string) => {
    return activeTab === itemId
      ? "bg-primary text-primary-foreground font-medium"
      : "hover:bg-muted/50";
  };

  return (
    <Sidebar
      className={open ? "w-60" : "w-14"}
      collapsible="icon"
    >
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Controle de Arbitragem</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    onClick={() => onTabChange(item.id)}
                    className={getButtonClass(item.id)}
                  >
                    <item.icon className="h-4 w-4" />
                    {open && <span>{item.label}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
