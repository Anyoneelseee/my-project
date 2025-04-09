// src/components/professor-sidebar.tsx
"use client";

import * as React from "react";
import {
  AudioWaveform,
  Command,
  GalleryVerticalEnd,
  SquareTerminal,
  PlusCircle,
} from "lucide-react";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { TeamSwitcher } from "@/components/team-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";

// Interface for a class
interface Class {
  id: string;
  name: string;
  section: string;
  course: string;
  code: string;
}

export function ProfessorSidebar({
  classes = [],
  ...props
}: React.ComponentProps<typeof Sidebar> & { classes?: Class[] }) {
  const data = {
    user: {
      name: "Professor Name",
      email: "professor@example.com",
      avatar: "/avatars/professor.jpg",
    },
    teams: [
      {
        name: "Class X",
        logo: GalleryVerticalEnd,
        plan: "Professor",
      },
      {
        name: "Class Y",
        logo: AudioWaveform,
        plan: "Professor",
      },
      {
        name: "Class Z",
        logo: Command,
        plan: "Professor",
      },
    ],
    navMain: [
      {
        title: "Playground",
        url: "/playground",
        icon: SquareTerminal,
        isActive: true,
      },
      {
        title: "Created Classes",
        url: "/dashboard/professor/created-classes",
        icon: PlusCircle,
        items: classes.map((cls) => ({
          title: `${cls.name} (${cls.section})`,
          url: `/dashboard/professor/created-classes/${cls.id}`,
        })),
      },
    ],
  };

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}