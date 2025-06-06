"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

interface CreateActivityDialogProps {
  classId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onActivityCreated: () => void;
}

export function CreateActivityDialog({
  classId,
  isOpen,
  onOpenChange,
  onActivityCreated,
}: CreateActivityDialogProps) {
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateActivity = async () => {
    if (!description) {
      alert("Please enter a description for the activity.");
      return;
    }

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        console.error("No session in create activity:", sessionError?.message);
        alert("Session expired. Please log in again.");
        return;
      }

      setIsSubmitting(true);

      const { error: insertError } = await supabase
        .from("activities")
        .insert([
          {
            class_id: classId,
            description,
          },
        ]);

      if (insertError) {
        console.error("Error creating activity:", insertError.message, insertError.details, insertError.hint);
        alert("Failed to create activity. Please try again.");
        setIsSubmitting(false);
        return;
      }

      setDescription("");
      setIsSubmitting(false);
      onOpenChange(false);
      onActivityCreated();
      alert("Activity created successfully!");
    } catch (err) {
      console.error("Unexpected error in create activity:", err);
      alert("An unexpected error occurred. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gradient-to-br from-gray-800 to-gray-900 border-teal-500/20 rounded-xl shadow-2xl p-6 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold text-teal-400">
            Create a New Activity
          </DialogTitle>
          <DialogDescription className="text-gray-200 mt-2">
            Add a description for the activity.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-1 gap-2">
            <Label htmlFor="description" className="text-sm font-medium text-teal-300">
              Description
            </Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="col-span-3 border border-gray-600 rounded-lg p-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-none bg-gray-700/50 text-gray-200"
              placeholder="e.g., Write a program to calculate the factorial of a number."
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={handleCreateActivity}
            disabled={isSubmitting}
            className="w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "Submitting..." : "Create Activity"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}