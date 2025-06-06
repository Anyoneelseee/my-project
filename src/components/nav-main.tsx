"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";

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
  // Debug items
  console.log("NavMain items:", items);

  // Handle empty or invalid items
  if (!items || !Array.isArray(items)) {
    return (
      <SidebarGroup>
        <SidebarGroupLabel className="text-gray-400">No navigation items</SidebarGroupLabel>
      </SidebarGroup>
    );
  }

  return (
    <SidebarGroup className="bg-transparent">
      <SidebarGroupLabel className="text-teal-400">Platform</SidebarGroupLabel>
      <SidebarMenu className="bg-transparent">
        {items.map((item) =>
          item && item.title && item.url ? (
            item.items && item.items.length > 0 ? (
              <Collapsible
                key={item.title}
                asChild
                defaultOpen={item.isActive}
                className="group/collapsible bg-transparent"
              >
                <SidebarMenuItem className="bg-transparent">
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      tooltip={item.title}
                      className={
                        item.isActive
                          ? "bg-transparent text-teal-400 hover:bg-teal-500/20"
                          : "bg-transparent text-gray-200 hover:bg-teal-500/20 hover:text-teal-400"
                      }
                    >
                      {item.icon && <item.icon className="mr-2" />}
                      <span>{item.title}</span>
                      <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 text-gray-400" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="bg-transparent">
                    <SidebarMenuSub className="bg-transparent">
                      {item.items.map((subItem) =>
                        subItem && subItem.title && subItem.url ? (
                          <SidebarMenuSubItem key={subItem.title} className="bg-transparent">
                            <SidebarMenuSubButton asChild className="bg-transparent text-gray-200 hover:bg-teal-500/20 hover:text-teal-400">
                              <Link
                                href={subItem.url}
                                className="bg-transparent text-gray-200 hover:bg-teal-500/20 hover:text-teal-400"
                              >
                                <span>{subItem.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ) : null
                      )}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            ) : (
              <SidebarMenuItem key={item.title} className="bg-transparent">
                <SidebarMenuButton
                  asChild
                  tooltip={item.title}
                  className={
                    item.isActive
                      ? "bg-transparent text-teal-400 hover:bg-teal-500/20"
                      : "bg-transparent text-gray-200 hover:bg-teal-500/20 hover:text-teal-400"
                  }
                >
                  <Link href={item.url}>
                    {item.icon && <item.icon className="mr-2" />}
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          ) : null
        )}
      </SidebarMenu>
    </SidebarGroup>
  );
}