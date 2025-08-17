"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import {
  BarChart2,
  SquareTerminal,
  PlusCircle,
  LineChart,
  Upload,
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
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";

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
    avatar: "",
  });

  useEffect(() => {
    console.log("ProfessorSidebar classes:", classes);
    const fetchUser = async () => {
      try {
        const { data: { user: authUser }, error } = await supabase.auth.getUser();
        if (error || !authUser) {
          console.error("Failed to fetch user:", error?.message);
          return;
        }
        const { data: userData, error: userError } = await supabase
          .rpc("get_user_profile", { user_id_input: authUser.id });
        if (userError || !userData || userData.length === 0) {
          console.warn("Failed to fetch user details:", userError?.message || "No user data found");
          setUser({
            name: authUser.email?.split("@")[0] || "Professor",
            email: authUser.email || "professor@example.com",
            avatar: "",
          });
          return;
        }
        const userProfile = userData[0];
        setUser({
          name: userProfile.first_name && userProfile.last_name
            ? `${userProfile.first_name} ${userProfile.last_name}`.trim()
            : authUser.email?.split("@")[0] || "Professor",
          email: userProfile.email || "professor@example.com",
          avatar: userProfile.avatar_url || "",
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
      {
        title: "Bulk AI Checker and Similarity",
        url: "/dashboard/professor/bulk-ai-checker",
        icon: Upload,
      },
    ],
  };

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <Avatar className="h-12 w-12 rounded-xl bg-slate-700 ring-2 ring-teal-400/50">
          <AvatarImage src={user.avatar} alt={user.name} />
          <AvatarFallback className="rounded-xl text-slate-200 text-2xl font-semibold">
            {user.name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
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
