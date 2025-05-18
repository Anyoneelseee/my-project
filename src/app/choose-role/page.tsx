"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUserRole } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import Image from "next/image";

export default function ChooseRole() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkRole = async () => {
      try {
        const role = await getUserRole();
        console.log("ChooseRole - Role:", role);
        if (role) {
          router.push(`/dashboard/${role}`);
        }
      } catch (error) {
        console.error("ChooseRole - Error fetching role:", error);
      }
    };
    checkRole();
  }, [router]);

  const selectRole = async (role: string) => {
    setLoading(true);
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData?.user) {
      console.error("ChooseRole - Auth error:", authError?.message);
      router.push("/login");
      setLoading(false);
      return;
    }

    const { data: existingUser, error: fetchError } = await supabase
      .from("users")
      .select("role")
      .eq("id", authData.user.id)
      .single();

    console.log("ChooseRole - Existing user:", existingUser, "Fetch error:", fetchError);

    if (fetchError) {
      console.error("ChooseRole - Error fetching user:", fetchError.message);
      setLoading(false);
      return;
    }

    if (existingUser?.role) {
      console.log("ChooseRole - User already has role:", existingUser.role);
      router.push(`/dashboard/${existingUser.role}`);
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("users")
      .upsert([{ id: authData.user.id, role }], { onConflict: "id" })
      .select();

    if (updateError) {
      console.error("ChooseRole - Update error:", updateError.message);
      setLoading(false);
      return;
    }

    console.log("ChooseRole - Role set to:", role);
    router.push(`/dashboard/${role}`);
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="uppercase text-2xl font-bold mb-6">Choose Your Role</h1>
      <div className="flex flex-row gap-6">
        <Button 
          variant="outline" 
          onClick={() => selectRole("student")} 
          disabled={loading} 
          className="w-48 h-30 flex items-center gap-2 text-[20px] shadow-xl border-2 border-gray-400 rounded-lg transition delay-150 duration-300 ease-in-out hover:-translate-y-1 hover:scale-110 hover:border-black"
        >
          <Image src="/carmalogo.png" alt="Student" width={50} height={50} />
          Student
        </Button>
        <Button 
          variant="outline" 
          onClick={() => selectRole("professor")} 
          disabled={loading} 
          className="w-48 h-30 flex items-center gap-2 text-[20px] shadow-xl border-2 border-gray-400 rounded-lg transition delay-150 duration-300 ease-in-out hover:-translate-y-1 hover:scale-110 hover:border-black"
        >
          <Image src="/carmalogo.png" alt="Professor" width={50} height={50} />
          Professor
        </Button>
      </div>
    </div>
  );
}