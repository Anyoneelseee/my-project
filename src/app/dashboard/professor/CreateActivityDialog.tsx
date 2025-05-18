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
      // Ensure session is valid
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a New Activity</DialogTitle>
          <DialogDescription>
            Add a description for the activity.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">
              Description
            </Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="col-span-3 border rounded-md p-2"
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleCreateActivity} disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Create Activity"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}