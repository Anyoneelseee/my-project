// src/components/student-sidebar.tsx
"use client";

import * as React from "react";
import {
  AudioWaveform,
  Command,
  GalleryVerticalEnd,
  SquareTerminal,
  Users,
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

// Define the props type for StudentSidebar
interface StudentSidebarProps extends React.ComponentProps<typeof Sidebar> {
  classes?: Class[];
}

export function StudentSidebar({ classes = [], ...props }: StudentSidebarProps) {
  const data = {
    user: {
      name: "Student Name",
      email: "student@example.com",
      avatar: "/avatars/student.jpg",
    },
    teams: [
      {
        name: "Class A",
        logo: GalleryVerticalEnd,
        plan: "Student",
      },
      {
        name: "Class B",
        logo: AudioWaveform,
        plan: "Student",
      },
      {
        name: "Class C",
        logo: Command,
        plan: "Student",
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
        title: "My Classes",
        url: "/dashboard/student/my-classes",
        icon: Users,
        items: classes.length > 0
          ? classes.map((cls) => ({
              title: `${cls.name} (${cls.section})`,
              url: `/dashboard/student/my-classes/${cls.id}`,
            }))
          : [{ title: "No classes joined yet", url: "#" }],
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