// app/dashboard/professor/ClassCodeDialog.tsx
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
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ClassCodeDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  classCode: string;
}

export function ClassCodeDialog({ isOpen, onOpenChange, classCode }: ClassCodeDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(classCode);
      setCopied(true);
      toast.success("Class code copied!", {
        description: "Students can now join using this code.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gradient-to-br from-gray-900/95 via-blue-950/90 to-gray-900/95 backdrop-blur-xl border border-teal-500/30 rounded-2xl shadow-2xl p-6 max-w-md">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-2xl font-extrabold text-teal-400 drop-shadow-md flex items-center gap-2">
            Class Created!
          </DialogTitle>
          <DialogDescription className="text-teal-200">
            Share this code with your students to let them join.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-teal-500 to-purple-500 blur-xl opacity-30 group-hover:opacity-50 transition-opacity" />
            <div className="relative bg-gray-800/60 backdrop-blur-md border border-teal-500/40 rounded-xl p-6 text-center">
              <p className="text-4xl font-bold text-teal-300 tracking-widest font-mono">
                {classCode}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-3">
          <Button
            onClick={handleCopy}
            className="flex-1 bg-purple-500 hover:bg-purple-600 text-white font-bold transition-all"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                Copy Code
              </>
            )}
          </Button>
          <Button
            onClick={() => onOpenChange(false)}
            variant="outline"
            className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}