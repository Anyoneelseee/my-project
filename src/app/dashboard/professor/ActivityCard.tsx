"use client";

import { useState } from "react";
import Image from "next/image";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { FileText, Image as ImageIcon } from "lucide-react";

interface Activity {
  id: string;
  description: string;
  title: string;
  image_url: string | null;
  created_at: string;
  start_time: string;
  deadline: string;
}

interface ActivityCardProps {
  activity: Activity;
  signedUrl: string;
  onClick: () => void;
}

export function ActivityCard({ activity, signedUrl, onClick }: ActivityCardProps) {
  const [isDescriptionDialogOpen, setIsDescriptionDialogOpen] = useState(false);
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);

  const formatDate = (date: string) => new Date(date).toLocaleString();

  const getStatus = (start_time: string | null, deadline: string | null): { text: string; color: string } => {
    const now = new Date();
    const startDate = start_time ? new Date(start_time) : null;
    const deadlineDate = deadline ? new Date(deadline) : null;

    if (!start_time && !deadline) {
      return { text: "No Dates Set", color: "bg-gray-600" };
    }
    if (startDate && startDate.getTime() > now.getTime()) {
      return { text: "Not Started", color: "bg-blue-500" };
    }
    if (deadlineDate && deadlineDate.getTime() < now.getTime()) {
      return { text: "Ended", color: "bg-red-500" };
    }
    if (deadlineDate && deadlineDate.getTime() - now.getTime() < 24 * 60 * 60 * 1000) {
      return { text: "Due Soon", color: "bg-yellow-500" };
    }
    if (startDate && startDate.getTime() <= now.getTime()) {
      return { text: "In Progress", color: "bg-teal-500" };
    }
    return { text: "Upcoming", color: "bg-teal-500" };
  };

  return (
    <>
      <Card
        onClick={onClick}
        className="relative rounded-2xl border border-teal-500/30 bg-gradient-to-br from-gray-900/80 to-gray-800/80 backdrop-blur-md shadow-md hover:shadow-2xl hover:scale-105 transition-all duration-300 ease-out h-[380px] flex flex-col overflow-hidden cursor-pointer"
        aria-label={`Activity card: ${activity.title || "Untitled Activity"}`}
      >
        {/* Header with title + status badge */}
        <CardHeader className="p-5 flex flex-col gap-2">
          <CardTitle className="text-lg md:text-xl font-extrabold text-teal-400 truncate">
            {activity.title || "Untitled Activity"}
          </CardTitle>
          <div className="flex gap-2 flex-wrap">
            <span
              className={`text-xs font-semibold text-white px-2 py-0.5 rounded-full ${getStatus(
                activity.start_time,
                activity.deadline
              ).color}`}
            >
              {getStatus(activity.start_time, activity.deadline).text}
            </span>
          </div>
        </CardHeader>

        {/* Main Content */}
        <CardContent className="px-5 flex-1 flex flex-col justify-between">
          <div className="flex flex-row gap-3 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              className="text-teal-300 hover:text-white hover:bg-teal-600/30 w-fit"
              onClick={(e) => {
                e.stopPropagation();
                setIsDescriptionDialogOpen(true);
              }}
              aria-label={`View description for ${activity.title}`}
            >
              <FileText className="w-4 h-4 mr-2" /> Description
            </Button>

            {signedUrl && !activity.image_url?.includes("null") && (
              <Button
                variant="ghost"
                size="sm"
                className="text-teal-300 hover:text-white hover:bg-teal-600/30 w-fit"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsImageDialogOpen(true);
                }}
                aria-label={`View image for ${activity.title}`}
              >
                <ImageIcon className="w-4 h-4 mr-2" /> Image
              </Button>
            )}
          </div>
        </CardContent>

        {/* Footer with dates */}
        <CardFooter className="p-5 grid grid-cols-1 gap-2 mt-2 bg-gray-800/40 rounded-b-2xl">
          <p className="text-sm font-medium text-teal-200 bg-gray-700/50 px-3 py-1 rounded-full w-fit">
            Created: {formatDate(activity.created_at)}
          </p>
          <p className="text-sm font-medium text-teal-200 bg-gray-700/50 px-3 py-1 rounded-full w-fit">
            Start: {formatDate(activity.start_time)}
          </p>
          <p className="text-sm font-medium text-teal-200 bg-gray-700/50 px-3 py-1 rounded-full w-fit">
            Deadline: {formatDate(activity.deadline)}
          </p>
        </CardFooter>
      </Card>

      {/* Description Dialog */}
      <Dialog open={isDescriptionDialogOpen} onOpenChange={setIsDescriptionDialogOpen}>
        <DialogContent className="bg-gradient-to-br from-gray-900/90 to-gray-800/90 border-teal-500/30 rounded-2xl backdrop-blur-md p-6 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-extrabold text-teal-400">
              {activity.title || "Untitled Activity"}
            </DialogTitle>
            <DialogDescription className="text-teal-300 text-sm">
              Activity description
            </DialogDescription>
          </DialogHeader>
          <div className="text-teal-200 text-base max-h-[50vh] overflow-y-auto leading-relaxed">
            {activity.description || "No description available"}
          </div>
          <DialogFooter className="mt-6">
            <Button
              onClick={() => setIsDescriptionDialogOpen(false)}
              className="bg-teal-500 hover:bg-teal-600 text-white font-semibold py-2 px-6 rounded-lg"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Dialog */}
      <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
        <DialogContent className="bg-gradient-to-br from-gray-900/90 to-gray-800/90 border-teal-500/30 rounded-2xl backdrop-blur-md p-6 max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-extrabold text-teal-400">
              {activity.title || "Untitled Activity"} Image
            </DialogTitle>
            <DialogDescription className="text-teal-300 text-sm">
              Activity image
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center">
            <Image
              src={signedUrl || "/images/placeholder-image.jpg"}
              alt={`Activity ${activity.title || "Untitled"}`}
              width={900}
              height={650}
              className="rounded-md max-w-full max-h-[60vh] object-contain shadow-lg"
              unoptimized
              loading="lazy"
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                if (!img.src.includes("/images/placeholder-image.jpg")) {
                  img.src = "/images/placeholder-image.jpg";
                }
              }}
            />
          </div>
          <DialogFooter className="mt-6">
            <Button
              onClick={() => setIsImageDialogOpen(false)}
              className="bg-teal-500 hover:bg-teal-600 text-white font-semibold py-2 px-6 rounded-lg"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
