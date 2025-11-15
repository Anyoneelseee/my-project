// app/dashboard/professor/CreateClassDialog.tsx
"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X } from "lucide-react";
import { ChangeEvent } from "react";

interface CreateClassDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  newClass: { name: string; section: string; course: string };
  setNewClass: (newClass: { name: string; section: string; course: string }) => void;
  onCreateClass: () => void;
}

export function CreateClassDialog({
  isOpen,
  onOpenChange,
  newClass,
  setNewClass,
  onCreateClass,
}: CreateClassDialogProps) {
  const handleCancel = () => {
    setNewClass({ name: "", section: "", course: "" });
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gradient-to-br from-gray-900/95 via-blue-950/90 to-gray-900/95 backdrop-blur-xl border border-teal-500/30 rounded-2xl shadow-2xl p-6 max-w-md">
        {/* Header */}
        <DialogHeader className="pb-4">
          <DialogTitle className="text-2xl font-extrabold text-teal-400 drop-shadow-md flex items-center gap-2">
            <div className="p-2 rounded-xl bg-teal-500/20 border border-teal-400/40">
              <Plus className="w-5 h-5 text-teal-300" />
            </div>
            Create a New Class
          </DialogTitle>
          <DialogDescription className="text-teal-200 mt-1">
            Enter class details to get started.
          </DialogDescription>
        </DialogHeader>

        {/* Form */}
        <div className="grid gap-5 py-2">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-semibold text-teal-300 flex items-center gap-1">
              Class Name
            </Label>
            <Input
              id="name"
              value={newClass.name}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setNewClass({ ...newClass, name: e.target.value })
              }
              placeholder="e.g., Introduction to Programming"
              className="bg-gray-800/60 backdrop-blur-md border border-gray-600 text-gray-100 placeholder:text-gray-500 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:shadow-lg focus:shadow-teal-500/20 transition-all"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="section" className="text-sm font-semibold text-teal-300 flex items-center gap-1">
              Section
            </Label>
            <Input
              id="section"
              value={newClass.section}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setNewClass({ ...newClass, section: e.target.value })
              }
              placeholder="e.g., A"
              className="bg-gray-800/60 backdrop-blur-md border border-gray-600 text-gray-100 placeholder:text-gray-500 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:shadow-lg focus:shadow-teal-500/20 transition-all"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="course" className="text-sm font-semibold text-teal-300 flex items-center gap-1">
              Course Code
            </Label>
            <Input
              id="course"
              value={newClass.course}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setNewClass({ ...newClass, course: e.target.value })
              }
              placeholder="e.g., CS101"
              className="bg-gray-800/60 backdrop-blur-md border border-gray-600 text-gray-100 placeholder:text-gray-500 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:shadow-lg focus:shadow-teal-500/20 transition-all"
            />
          </div>
        </div>

        {/* Footer Buttons - STUNNING */}
        <DialogFooter className="flex gap-3 mt-6">
          {/* CANCEL BUTTON */}
          <Button
            variant="outline"
            onClick={handleCancel}
            className="flex-1 group relative overflow-hidden border border-red-500/40 text-red-300 hover:text-white font-semibold transition-all duration-300"
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              <X className="w-4 h-4" />
              Cancel
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-red-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </Button>

          {/* CREATE BUTTON */}
          <Button
            onClick={onCreateClass}
            className="flex-1 group relative overflow-hidden bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white font-bold shadow-lg shadow-teal-500/30 hover:shadow-xl hover:shadow-teal-500/50 transition-all duration-300"
          >
            <span className="relative z-10 flex items-center justify-center gap-2">              Create Class
            </span>
            <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}