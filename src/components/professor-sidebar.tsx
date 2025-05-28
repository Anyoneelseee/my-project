"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import {
  BarChart2,
  SquareTerminal,
  PlusCircle,
  LineChart, // Added for Analytics icon
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
  const [user, setUser] = useState({
    name: "Professor Name",
    email: "professor@example.com",
    avatar: "/avatars/professor.jpg",
  });

  useEffect(() => {
    console.log("ProfessorSidebar classes:", classes);
    const fetchUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
          console.error("Failed to fetch user:", error?.message);
          return;
        }
        // Fetch additional user details from the users table
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
            : user.email?.split("@")[0] || "Professor",
          email: user.email || "professor@example.com",
          avatar: user.user_metadata?.avatar_url || "/avatars/professor.jpg",
        });
      } catch (err) {
        console.error("Unexpected error fetching user:", err);
      }
    };

    fetchUser();
  }, [classes]);

  const data = {
    user,
    navMain: [
      {
        title: "Playground",
        url: "/playground",
        icon: SquareTerminal,
        isActive: true,
      },
      {
        title: "Created Classes",
        url: "/dashboard/professor",
        icon: PlusCircle,
        items: classes.filter(cls => cls && cls.id && cls.name && cls.section).map((cls) => ({
          title: `${cls.name} (${cls.section})`,
          url: `/dashboard/professor/${cls.id}`,
        })),
      },
      {
        title: "Monitoring",
        url: "/dashboard/professor/monitoring",
        icon: BarChart2,
        items: classes.filter(cls => cls && cls.id && cls.name && cls.section).map((cls) => ({
          title: `${cls.name} (${cls.section})`,
          url: `/dashboard/professor/monitoring/${cls.id}`,
        })),
      },
      {
        title: "Analytics",
        url: "/dashboard/professor/analytics",
        icon: LineChart,
        items: classes.filter(cls => cls && cls.id && cls.name && cls.section).map((cls) => ({
          title: `${cls.name} (${cls.section})`,
          url: `/dashboard/professor/analytics/${cls.id}`,
        })),
      },
    ],
  };

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
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