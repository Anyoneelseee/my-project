"use client";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ClassCodeDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  classCode: string;
}

export function ClassCodeDialog({ isOpen, onOpenChange, classCode }: ClassCodeDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gradient-to-br from-gray-800 to-gray-900 border-teal-500/20 rounded-xl shadow-2xl p-6 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold text-teal-400">
            Class Created Successfully!
          </DialogTitle>
          <DialogDescription className="text-gray-200 mt-2">
            Share this class code with your students so they can join the class.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p
            className="text-center text-xl font-bold text-teal-300 bg-gray-700/50 px-4 py-2 rounded-lg"
          >
            {classCode}
          </p>
        </div>
        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button
            onClick={() => {
              navigator.clipboard.writeText(classCode);
              toast.success("Class code copied to clipboard!", {
                style: {
                  background: "#1f2937",
                  color: "#e5e7eb",
                  border: "1px solid #2dd4bf",
                },
              });
            }}
            className="w-full sm:w-auto bg-teal-500 hover:bg-teal-600 text-white font-semibold py-2 rounded-lg transition-colors"
          >
            Copy Code
          </Button>
          <Button
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto bg-gray-700/50 hover:bg-gray-600 text-gray-200 font-semibold py-2 rounded-lg transition-colors"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
