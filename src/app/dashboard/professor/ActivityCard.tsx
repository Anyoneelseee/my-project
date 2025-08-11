import Image from "next/image";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

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

  return (
    <>
      <Card
        onClick={onClick}
        className="shadow-lg rounded-xl border-teal-500/20 hover:shadow-2xl hover:scale-[1.02] hover:-translate-y-1 hover:z-10 transition-all duration-300 ease-out h-[320px] flex flex-col justify-between overflow-hidden cursor-pointer"
        style={{ backgroundColor: "#003559" }}
      >
        <CardHeader className="p-4 rounded-t-xl" style={{ backgroundColor: "#003559" }}>
          <CardTitle className="text-xl md:text-2xl font-bold truncate text-teal-400">
            {activity.title || "Untitled Activity"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 flex-1 flex flex-col justify-between">
          <div className="space-y-3 text-left">
            <div>
              <Button
                variant="link"
                className="text-teal-400 text-sm p-0 h-auto inline-block"
                onClick={(e) => {
                  e.stopPropagation(); // Prevent card click
                  setIsDescriptionDialogOpen(true);
                }}
              >
                View Description
              </Button>
            </div>
            {signedUrl && !activity.image_url?.includes("null") ? (
              <div>
                <Button
                  variant="link"
                  className="text-teal-400 text-sm p-0 h-auto inline-block"
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent card click
                    setIsImageDialogOpen(true);
                  }}
                >
                  View Image
                </Button>
              </div>
            ) : null}
          </div>
          <div className="mt-4 space-y-1">
            <p
              className="text-sm font-semibold px-3 py-1 rounded-full inline-block"
              style={{
                color: "#B9D6F2",
                backgroundColor: "#0353A4",
              }}
            >
              Created: {new Date(activity.created_at).toLocaleString()}
            </p>
            <p
              className="text-sm font-semibold px-3 py-1 rounded-full inline-block"
              style={{
                color: "#B9D6F2",
                backgroundColor: "#0353A4",
              }}
            >
              Start: {new Date(activity.start_time).toLocaleString()}
            </p>
            <p
              className="text-sm font-semibold px-3 py-1 rounded-full inline-block"
              style={{
                color: "#B9D6F2",
                backgroundColor: "#0353A4",
              }}
            >
              Deadline: {new Date(activity.deadline).toLocaleString()}
            </p>
          </div>
        </CardContent>
      </Card>
      <Dialog open={isDescriptionDialogOpen} onOpenChange={setIsDescriptionDialogOpen}>
        <DialogContent className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 border-teal-500/20 rounded-3xl shadow-lg backdrop-blur-md p-4 max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold text-teal-400">
              {activity.title || "Untitled Activity"} Description
            </DialogTitle>
          </DialogHeader>
          <div className="text-teal-300 text-sm max-h-[60vh] overflow-y-auto">
            {activity.description || "No description"}
          </div>
          <DialogFooter className="mt-4">
            <Button
              onClick={() => setIsDescriptionDialogOpen(false)}
              className="bg-teal-500 hover:bg-teal-600 text-white font-semibold py-2 rounded-lg"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
        <DialogContent className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 border-teal-500/20 rounded-3xl shadow-lg backdrop-blur-md p-4 max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold text-teal-400">
              {activity.title || "Untitled Activity"} Image
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-center">
            <Image
              src={signedUrl}
              alt="Full-size Activity"
              width={800}
              height={600}
              className="rounded-md max-w-full max-h-[60vh] object-contain"
              unoptimized
              loading="lazy"
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                if (!img.src.includes("/placeholder-image.jpg")) {
                  img.src = "/placeholder-image.jpg";
                }
              }}
            />
          </div>
          <DialogFooter className="mt-4">
            <Button
              onClick={() => setIsImageDialogOpen(false)}
              className="bg-teal-500 hover:bg-teal-600 text-white font-semibold py-2 rounded-lg"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
