// File: src/components/StudentSidebar.tsx
"use client";

import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { Command, SquareTerminal, Users, Upload } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { NavMain } from "@/components/nav-main";
import { StudentNavUser } from "@/components/StudentNavUser";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";

interface Class {
  id: string;
  name: string;
  section: string;
  course: string;
  code: string;
}

interface StudentSidebarProps extends React.ComponentProps<typeof Sidebar> {
  classes?: Class[];
}

export function StudentSidebar({ classes = [], ...props }: StudentSidebarProps) {
  const [user, setUser] = useState({
    name: "Student Name",
    email: "student@example.com",
    avatar: "",
  });

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const {
          data: { user: authUser },
          error,
        } = await supabase.auth.getUser();
        if (error || !authUser) {
          console.error("Failed to fetch user:", error?.message);
          return;
        }

        const { data: userData, error: userError } = await supabase.rpc(
          "get_user_profile",
          { user_id_input: authUser.id }
        );

        if (userError || !userData || userData.length === 0) {
          setUser({
            name: authUser.email?.split("@")[0] || "Student",
            email: authUser.email || "student@example.com",
            avatar: "",
          });
          return;
        }

        const userProfile = userData[0];
        setUser({
          name:
            userProfile.first_name && userProfile.last_name
              ? `${userProfile.first_name} ${userProfile.last_name}`.trim()
              : authUser.email?.split("@")[0] || "Student",
          email: userProfile.email || authUser.email || "student@example.com",
          avatar: userProfile.avatar_url || "",
        });
      } catch (err) {
        console.error("Unexpected error fetching user:", err);
      }
    };

    fetchUser();
  }, []);

  const memoizedUser = useMemo(() => user, [user.email, user.name, user.avatar]);

  const data = {
    user: memoizedUser,
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
        items:
          classes.length > 0
            ? classes.map((cls) => ({
                title: `${cls.name} (${cls.section})`,
                url: `/dashboard/student/my-classes/${cls.id}`,
              }))
            : [{ title: "No classes joined yet", url: "#" }],
      },
      {
        title: "Bulk AI Checker and Similarity",
        url: "/dashboard/student/bulk-ai-checker",
        icon: Upload,
      },
    ],
  };

  return (
    <Sidebar
      collapsible="icon"
      className="font-sans bg-transparent [&[data-slot=sidebar-container]]:bg-gradient-to-br [&[data-slot=sidebar-container]]:from-gray-800 [&[data-slot=sidebar-container]]:to-gray-900 [&[data-slot=sidebar-container]]:border-r [&[data-slot=sidebar-container]]:border-teal-500/20 [&[data-slot=sidebar-inner]]:bg-gradient-to-br [&[data-slot=sidebar-inner]]:from-gray-800 [&[data-slot=sidebar-inner]]:to-gray-900"
      {...props}
    >
      <SidebarHeader className="bg-transparent" />
      <SidebarContent className="bg-transparent">
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter className="bg-transparent">
        <StudentNavUser key={memoizedUser.email} user={memoizedUser} />
      </SidebarFooter>
      <SidebarRail className="bg-transparent hover:bg-teal-500/20" />
    </Sidebar>
  );
}
