"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  ChevronsUpDown,
  LogOut,
  Settings2,
  User,
} from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function NavUser({
  user,
}: {
  user: {
    name: string;
    email: string;
    avatar: string;
  };
}) {
  const { isMobile } = useSidebar();
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    router.push("/login");
  };

  const handleProfile = () => {
    router.push("/profiles");
  };

  const handleSettings = () => {
    router.push("/settings");
  };

  return (
    <>
      <SidebarMenu className="bg-transparent">
        <SidebarMenuItem className="bg-transparent">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="bg-transparent data-[state=open]:bg-teal-500/20 data-[state=open]:text-teal-400"
              >
                <Avatar className="h-8 w-8 rounded-lg bg-gray-700">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="rounded-lg text-gray-200">
                    {user.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium text-gray-200">{user.name}</span>
                  <span className="truncate text-xs text-gray-400">{user.email}</span>
                </div>
                <ChevronsUpDown className="ml-auto size-4 text-gray-400" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 border-teal-500/20"
              side={isMobile ? "bottom" : "right"}
              align="end"
              sideOffset={4}
            >
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="h-8 w-8 rounded-lg bg-gray-700">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="rounded-lg text-gray-200">
                      {user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium text-gray-200">{user.name}</span>
                    <span className="truncate text-xs text-gray-400">{user.email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-gray-600/30" />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onClick={handleProfile}
                  className="text-gray-200 hover:bg-teal-500/20 hover:text-teal-400"
                >
                  <User className="mr-2" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-gray-600/30" />
                <DropdownMenuItem
                  onClick={handleSettings}
                  className="text-gray-200 hover:bg-teal-500/20 hover:text-teal-400"
                >
                  <Settings2 className="mr-2" />
                  Settings
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator className="bg-gray-600/30" />
              <DropdownMenuGroup>
                <DropdownMenuItem className="text-gray-200 hover:bg-teal-500/20 hover:text-teal-400">
                  <Bell className="mr-2" />
                  Notifications
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator className="bg-gray-600/30" />
              <DropdownMenuItem
                onClick={() => setIsDialogOpen(true)}
                className="text-gray-200 hover:bg-teal-500/20 hover:text-teal-400"
              >
                <LogOut className="mr-2" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-gradient-to-br from-gray-800 to-gray-900 border-teal-500/20">
          <DialogHeader>
            <DialogTitle className="text-teal-400">Confirm Logout</DialogTitle>
            <DialogDescription className="text-gray-200">
              Are you sure you want to log out? You will need to sign in again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              className="bg-gray-700/50 text-gray-200 border-gray-600 hover:bg-gray-600"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Logout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
