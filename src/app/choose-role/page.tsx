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
        if (role) {
          router.push(`/dashboard/${role}`);
        }
      } catch (error) {
        console.error("Error fetching role:", error);
      }
    };
    checkRole();
  }, [router]);

  const selectRole = async (role: string) => {
    setLoading(true);
    const { data: authData, error } = await supabase.auth.getUser();

    if (error || !authData?.user) {
      router.push("/login");
      return;
    }

    const { error: updateError } = await supabase
      .from("users")
      .update({ role })
      .eq("id", authData.user.id)
      .select();

    if (updateError) {
      console.error(updateError.message);
      setLoading(false);
      return;
    }

    router.push(`/dashboard/${role}`);
  };

  return (
      
    <div className="flex flex-col items-center justify-center h-screen ">
  <h1 className="uppercase text-2xl font-bold mb-6 ">Choose Your Role</h1>

  <div className="flex flex-row gap-6 ">
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
