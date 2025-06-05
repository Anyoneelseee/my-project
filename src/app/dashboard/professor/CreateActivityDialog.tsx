"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
      <DialogContent className="bg-white rounded-xl shadow-2xl p-6 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold text-gray-900">
            Create a New Activity
            {/* Customize title text color (text-gray-900) in className */}
          </DialogTitle>
          <DialogDescription className="text-gray-600 mt-2">
            Add a description for the activity.
            {/* Customize description text color (text-gray-600) in className */}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-1 gap-2">
            <Label
              htmlFor="description"
              className="text-sm font-medium text-gray-700"
              // Customize label text color (text-gray-700) in className
            >
              Description
            </Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="col-span-3 border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
              placeholder="e.g., Write a program to calculate the factorial of a number."
              rows={4}
              // Customize textarea border (border-gray-300) and focus ring (focus:ring-purple-500) in className
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={handleCreateActivity}
            disabled={isSubmitting}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 rounded-lg transition-colors disabled:opacity-50"
            // Customize button background color (bg-purple-600) and hover color (hover:bg-purple-700) in className
          >
            {isSubmitting ? "Submitting..." : "Create Activity"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}