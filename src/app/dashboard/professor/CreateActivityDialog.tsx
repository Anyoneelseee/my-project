// src/app/dashboard/professor/CreateActivityDialog.tsx
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
import { Input } from "@/components/ui/input";
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
    }
  };

  const handleCreateActivity = async () => {
    if (!description) {
      alert("Please enter a description for the activity.");
      return;
    }

    setIsUploading(true);
    let imageUrl: string | null = null;

    // Upload image to Supabase Storage if an image is selected
    if (imageFile) {
      const fileExt = imageFile.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `activities/${classId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("activity-images")
        .upload(filePath, imageFile);

      if (uploadError) {
        console.error("Error uploading image:", uploadError);
        alert("Failed to upload image. Please try again.");
        setIsUploading(false);
        return;
      }

      // Get the public URL of the uploaded image
      const { data } = supabase.storage
        .from("activity-images")
        .getPublicUrl(filePath);

      imageUrl = data.publicUrl;
    }

    // Insert the activity into the database
    const { error: insertError } = await supabase
      .from("activities")
      .insert([
        {
          class_id: classId,
          description,
          image_url: imageUrl,
        },
      ]);

    if (insertError) {
      console.error("Error creating activity:", insertError);
      alert("Failed to create activity. Please try again.");
      setIsUploading(false);
      return;
    }

    setDescription("");
    setImageFile(null);
    setIsUploading(false);
    onOpenChange(false);
    onActivityCreated();
    alert("Activity created successfully!");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a New Activity</DialogTitle>
          <DialogDescription>
            Add a description and optionally upload an image for the activity.
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
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="image" className="text-right">
              Image (Optional)
            </Label>
            <Input
              id="image"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleCreateActivity} disabled={isUploading}>
            {isUploading ? "Uploading..." : "Create Activity"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}