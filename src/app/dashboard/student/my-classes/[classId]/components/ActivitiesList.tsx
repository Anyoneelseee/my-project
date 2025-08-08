import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import Image from "next/image";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase"; // Import the pre-configured supabase instance

interface Activity {
  id: string;
  description: string;
  image_url: string | null;
  created_at: string;
}

export default function ActivitiesList({ activities, onActivitySelect }: { activities: Activity[]; onActivitySelect: (activityId: string) => void }) {
  const [signedImageUrls, setSignedImageUrls] = useState<{ [key: string]: string | null }>({});

  useEffect(() => {
    const fetchSignedUrls = async () => {
      const urls: { [key: string]: string | null } = {};
      for (const activity of activities) {
        if (activity.image_url) {
          try {
            const { data, error } = await supabase.storage
              .from("activity-images")
              .createSignedUrl(`${activity.image_url}`, 60); // 60 seconds expiration
            if (error) {
              console.error(`Failed to generate signed URL for ${activity.id}:`, error.message);
              urls[activity.id] = null;
            } else {
              urls[activity.id] = data.signedUrl;
            }
          } catch (err) {
            console.error(`Error fetching signed URL for ${activity.id}:`, err);
            urls[activity.id] = null;
          }
        } else {
          urls[activity.id] = null;
        }
      }
      setSignedImageUrls(urls);
    };

    fetchSignedUrls();
  }, [activities, supabase]);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>, activityId: string) => {
    console.error(`Image load failed for activity ${activityId}:`, e);
    e.currentTarget.style.display = "none"; // Hide broken image
  };

  return (
    <Card className="mb-6 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 border-teal-500/20">
      <CardHeader>
        <CardTitle className="text-2xl md:text-3xl font-extrabold text-teal-400">Activities</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {activities.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No activities created yet.</p>
        ) : (
          <ul className="space-y-6">
            {activities.map((activity) => (
              <li key={activity.id} className="border-b border-gray-600/30 pb-4 last:border-b-0">
                <button
                  onClick={() => onActivitySelect(activity.id)}
                  className="w-full text-left hover:bg-teal-500/20 p-2 rounded-lg transition-colors"
                >
                  <p className="text-base md:text-lg text-gray-200">{activity.description}</p>
                  {activity.image_url && signedImageUrls[activity.id] && (
                    <div className="mt-4">
                      <Image
                        src={signedImageUrls[activity.id]!}
                        alt={`Activity ${activity.id}`}
                        width={400}
                        height={300}
                        className="rounded-xl object-cover w-full max-w-[400px] h-auto transition-opacity duration-200 hover:opacity-90"
                        onError={(e) => handleImageError(e, activity.id)}
                      />
                    </div>
                  )}
                  <p className="text-sm md:text-base text-gray-400 mt-2">
                    Created at: {new Date(activity.created_at).toLocaleString()}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}