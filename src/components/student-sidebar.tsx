"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import {
  Command,
  SquareTerminal,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
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
  const [user, setUser] = useState({
    name: "Student Name",
    email: "student@example.com",
    avatar: "/avatars/student.jpg",
  });

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
          console.error("Failed to fetch user:", error?.message);
          return;
        }
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("first_name, last_name")
          .eq("id", user.id)
          .single();
        if (userError) {
          console.warn("Failed to fetch user details:", userError.message);
        }
        setUser({
          name: userData && userData.first_name && userData.last_name
            ? `${userData.first_name} ${userData.last_name}`.trim()
            : user.email?.split("@")[0] || "Student",
          email: user.email || "student@example.com",
          avatar: user.user_metadata?.avatar_url || "/avatars/student.jpg",
        });
      } catch (err) {
        console.error("Unexpected error fetching user:", err);
      }
    };

    fetchUser();
  }, []);

  const data = {
    user,
    teams: [
      {
        name: "Carma",
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
    <Sidebar
      collapsible="icon"
      className="bg-transparent [&[data-slot=sidebar-container]]:bg-gradient-to-br [&[data-slot=sidebar-container]]:from-gray-800 [&[data-slot=sidebar-container]]:to-gray-900 [&[data-slot=sidebar-container]]:border-r [&[data-slot=sidebar-container]]:border-teal-500/20 [&[data-slot=sidebar-inner]]:bg-gradient-to-br [&[data-slot=sidebar-inner]]:from-gray-800 [&[data-slot=sidebar-inner]]:to-gray-900"
      {...props}
    >
      <SidebarHeader className="bg-transparent" />
      <SidebarContent className="bg-transparent">
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter className="bg-transparent">
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail className="bg-transparent hover:bg-teal-500/20" />
    </Sidebar>
  );
}