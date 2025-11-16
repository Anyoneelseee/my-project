// src/components/NavMain.tsx
"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";

export function NavMain({
  items,
}: {
  items: {
    title: string;
    url: string;
    icon?: LucideIcon;
    isActive?: boolean;
    items?: {
      title: string;
      url: string;
    }[];
  }[];
}) {
  const pathname = usePathname();
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    const activeParents = items
      .filter((item) => item.items?.some((sub) => sub.url === pathname))
      .map((item) => item.title);
    setOpenItems(new Set(activeParents));
  }, [pathname, items]);

  if (!items || !Array.isArray(items) || items.length === 0) {
    return (
      <SidebarGroup className="p-4">
        <SidebarGroupLabel className="text-gray-500 text-sm">
          No navigation
        </SidebarGroupLabel>
      </SidebarGroup>
    );
  }

  const toggleOpen = (title: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  return (
    <SidebarGroup className="space-y-6 p-3 sm:p-4">
      {/* === PREMIUM LOGO === */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, type: "spring", stiffness: 200 }}
        className="relative"
      >
        <SidebarGroupLabel
          className="
            text-2xl sm:text-3xl md:text-4xl font-black tracking-tighter
            bg-gradient-to-r from-teal-300 via-cyan-400 to-emerald-400
            bg-clip-text text-transparent
            drop-shadow-[0_0_12px_rgba(94,234,212,0.6)]
            animate-pulse
          "
        >
          CARMA
        </SidebarGroupLabel>
        <div className="absolute -inset-1 bg-gradient-to-r from-teal-500/20 to-emerald-500/20 blur-xl -z-10" />
      </motion.div>

      {/* === NAV ITEMS === */}
      <SidebarMenu className="space-y-1">
        {items.map((item) => {
          if (!item?.title || !item?.url) return null;

          const isOpen = openItems.has(item.title);
          const subItems = item.items ?? [];
          const hasSubItems = subItems.length > 0;
          const isActive =
            item.isActive ||
            pathname === item.url ||
            subItems.some((sub) => sub.url === pathname);

          return (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* === PARENT ITEM === */}
              {hasSubItems ? (
                <Collapsible open={isOpen} onOpenChange={() => toggleOpen(item.title)}>
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        tooltip={item.title}
                        className={`
                          w-full justify-start group rounded-xl px-3 py-2.5 text-sm sm:text-base
                          transition-all duration-300 font-medium
                          ${isActive
                            ? "bg-gradient-to-r from-teal-500/20 to-emerald-500/20 text-teal-300 shadow-lg shadow-teal-500/20"
                            : "text-teal-300 hover:bg-teal-500/10 hover:text-teal-200"
                          }
                        `}
                      >
                        {item.icon && (
                          <item.icon className="w-4 h-4 sm:w-5 sm:h-5 mr-2.5 flex-shrink-0" />
                        )}
                        <span className="truncate">{item.title}</span>
                        <ChevronRight
                          className={`
                            ml-auto w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-300
                            ${isOpen ? "rotate-90 text-teal-300" : "text-teal-400"}
                          `}
                        />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>

                    {/* === CHILD ITEMS (ALWAYS TEAL, VISIBLE) === */}
                    <CollapsibleContent className="pl-6 sm:pl-8 mt-1 space-y-0.5">
                      <SidebarMenuSub>
                        {subItems.map((subItem) => {
                          if (!subItem?.title || !subItem?.url) return null;

                          const subActive = pathname === subItem.url;

                          return (
                            <motion.div
                              key={subItem.title}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -10 }}
                              transition={{ duration: 0.2 }}
                            >
                              <SidebarMenuSubItem>
                                <SidebarMenuSubButton asChild>
                                  <Link
                                    href={subItem.url}
                                    className={`
                                      block w-full text-left rounded-lg px-3 py-2 text-xs sm:text-sm
                                      font-medium transition-all duration-200
                                      ${subActive
                                        ? "bg-teal-500/20 text-teal-300 shadow-md shadow-teal-500/20"
                                        : "text-teal-300 hover:bg-teal-500/10 hover:text-teal-200"
                                      }
                                    `}
                                  >
                                    <span className="truncate">{subItem.title}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            </motion.div>
                          );
                        })}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              ) : (
                /* === SINGLE ITEM === */
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.title}
                    className={`
                      w-full justify-start group rounded-xl px-3 py-2.5 text-sm sm:text-base
                      font-medium transition-all duration-300
                      ${isActive
                        ? "bg-gradient-to-r from-teal-500/20 to-emerald-500/20 text-teal-300 shadow-lg shadow-teal-500/20"
                        : "text-teal-300 hover:bg-teal-500/10 hover:text-teal-200"
                      }
                    `}
                  >
                    <Link href={item.url} className="flex items-center">
                      {item.icon && (
                        <item.icon className="w-4 h-4 sm:w-5 sm:h-5 mr-2.5 flex-shrink-0" />
                      )}
                      <span className="truncate">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </motion.div>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}