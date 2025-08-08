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
  const [image, setImage] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setImage(event.target.files[0]);
    }
  };

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

      let imagePath = null;
      if (image) {
        const fileName = `${Date.now()}-${image.name}`.toLowerCase(); // Normalize to lowercase to avoid case issues
        const filePath = `image_activity/${fileName}`; // Ensure correct folder path
        console.log(`Uploading to: activity-images/${filePath}`);
        const { error: uploadError } = await supabase.storage
          .from("activity-images")
          .upload(filePath, image, {
            cacheControl: "3600",
            upsert: false,
            contentType: image.type,
          });

        if (uploadError) {
          console.error("Error uploading image:", uploadError.message);
          if (uploadError.message.includes("row-level security policy")) {
            alert("Upload failed due to storage policy restrictions. Please contact an administrator to update the 'activity-images' bucket policy.");
          } else {
            alert(`Failed to upload image: ${uploadError.message}. Please try again.`);
          }
          setIsSubmitting(false);
          return;
        }

        // Verify upload by listing the file
        const { data: fileList, error: listError } = await supabase.storage
          .from("activity-images")
          .list("image_activity", { search: fileName });
        if (listError || !fileList || fileList.length === 0) {
          console.error("File not found after upload:", listError?.message, "Searched for:", fileName);
          alert("Upload verification failed. File may not be stored correctly.");
          setIsSubmitting(false);
          return;
        }
        imagePath = filePath; // Store the full path
        console.log(`Uploaded image path verified: ${imagePath}`);
      }

      const { error: insertError } = await supabase
        .from("activities")
        .insert([
          {
            class_id: classId,
            description,
            image_url: imagePath, // Store the full path (e.g., "image_activity/1752926366514-prefessor.png")
          },
        ]);

      if (insertError) {
        console.error("Error creating activity:", insertError.message);
        alert("Failed to create activity. Please try again.");
        setIsSubmitting(false);
        return;
      }

      setDescription("");
      setImage(null);
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
            Add a description and optional image for the activity.
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
          <div className="grid grid-cols-1 gap-2">
            <Label htmlFor="image" className="text-sm font-medium text-teal-300">
              Image (Optional)
            </Label>
            <input
              id="image"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="col-span-3 border border-gray-600 rounded-lg p-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-gray-700/50 text-gray-200 file:bg-teal-500 file:text-white file:rounded-lg file:px-4 file:py-2 file:cursor-pointer file:hover:bg-teal-600"
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