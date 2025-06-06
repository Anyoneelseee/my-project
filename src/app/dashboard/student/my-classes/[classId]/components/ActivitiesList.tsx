import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import Image from "next/image";

interface Activity {
  id: string;
  description: string;
  image_url: string | null;
  created_at: string;
}

export default function ActivitiesList({ activities }: { activities: Activity[] }) {
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
                <p className="text-base md:text-lg text-gray-200">{activity.description}</p>
                {activity.image_url && (
                  <div className="mt-4">
                    <Image
                      src={activity.image_url}
                      alt="Activity"
                      width={400}
                      height={300}
                      className="rounded-xl object-cover w-full max-w-[400px] h-auto transition-opacity duration-200 hover:opacity-90"
                    />
                  </div>
                )}
                <p className="text-sm md:text-base text-gray-400 mt-2">
                  Created at: {new Date(activity.created_at).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}